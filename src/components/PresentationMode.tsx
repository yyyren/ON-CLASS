import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Users, 
  Download, 
  CheckCircle, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Camera, 
  Laptop, 
  TableProperties,
  ArrowRight,
  Clipboard,
  Smartphone,
  Maximize2,
  X
} from 'lucide-react';

interface PresentationStudent {
  id: string;
  name: string;
  course: string;
  semester: string;
  enrolledAt: string;
}

interface PresentationAttendance {
  id: string;
  studentId: string;
  studentName: string;
  course: string;
  semester: string;
  scannedAt: string;
  tokenUsed: string;
}

interface PresentationModeProps {
  onBack: () => void;
  initialOverrideMode?: 'presenter' | 'student';
}

export default function PresentationMode({ onBack, initialOverrideMode }: PresentationModeProps) {
  // Tranca o aluno na tela de celular caso acesse com o parâmetro de URL correto
  const isLockedStudent = (() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('mode') === 'apresentacao_aluno';
    } catch {
      return false;
    }
  })();

  const [role, setRole] = useState<'presenter' | 'student'>(() => {
    if (isLockedStudent) return 'student';
    if (initialOverrideMode) return initialOverrideMode;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') === 'apresentacao_aluno' ? 'student' : 'presenter';
  });

  // Estado do Token e Tempo aumentado para 30 segundos (30000ms)
  const [activeToken, setActiveToken] = useState<string>(() => {
    return localStorage.getItem('onclass_pres_active_token') || 'LIVE-ON95';
  });

  const [timeLeftMs, setTimeLeftMs] = useState<number>(30000);
  const [students, setStudents] = useState<PresentationStudent[]>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_students');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [attendances, setAttendances] = useState<PresentationAttendance[]>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_attendances');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);
  const [isServerOffline, setIsServerOffline] = useState<boolean>(false);

  // Estados do Aluno
  const [studentName, setStudentName] = useState('');
  const [studentCourse, setStudentCourse] = useState('');
  const [studentSemester, setStudentSemester] = useState('1º Semestre');
  const [currentStudent, setCurrentStudent] = useState<PresentationStudent | null>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_active_student');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [manualCode, setManualCode] = useState('');
  const [scanStatus, setScanStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: ''
  });

  const hasAlreadyCheckedIn = (() => {
    if (!currentStudent) return false;
    const inState = attendances.some(a => a.studentId === currentStudent.id);
    if (inState) return true;
    try {
      if (localStorage.getItem(`onclass_pres_submitted_${currentStudent.id}`) === 'true') {
        return true;
      }
    } catch {}
    return false;
  })();

  const [copiedLink, setCopiedLink] = useState(false);
  const [expandedQr, setExpandedQr] = useState<'enrollment' | 'token' | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);

  // Inicializador da Câmera do Aluno
  useEffect(() => {
    if (role !== 'student' || !currentStudent || hasAlreadyCheckedIn || scanStatus.type === 'success') {
      return;
    }

    const containerId = "qr-reader-container";
    let html5QrCode: Html5Qrcode | null = null;
    let isStarted = false;

    const startTimeout = setTimeout(() => {
      const element = document.getElementById(containerId);
      if (!element) return;

      try {
        html5QrCode = new Html5Qrcode(containerId);
        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: Math.max(160, size), height: Math.max(160, size) };
            }
          },
          (decodedText) => {
            let tokenValue = decodedText;
            try {
              if (decodedText.includes("mode=apresentacao_aluno")) {
                alert(`Você leu o QR Code de Cadastro (Passo 1).\nPor favor, aponte para o QR Code de Validação (Passo 2) com o código de tempo!`);
                return;
              }
            } catch (e) {}

            handleScanOrSubmitCode(tokenValue);
          },
          () => {}
        ).then(() => {
          isStarted = true;
          setIsCameraActive(true);
          setCameraPermissionError(null);
        }).catch((err) => {
          setCameraPermissionError("Não foi possível acessar a câmera. Digite o código manualmente.");
          setIsCameraActive(false);
        });
      } catch (e) {
        console.error(e);
      }
    }, 400);

    return () => {
      clearTimeout(startTimeout);
      if (html5QrCode && isStarted) {
        html5QrCode.stop().then(() => setIsCameraActive(false)).catch(err => console.warn(err));
      }
    };
  }, [role, currentStudent, hasAlreadyCheckedIn, scanStatus.type]);

  const [roomCode] = useState<string>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlRoom = urlParams.get('room');
      if (urlRoom) {
        localStorage.setItem('onclass_pres_room_code', urlRoom.toUpperCase());
        return urlRoom.toUpperCase();
      }
      const saved = localStorage.getItem('onclass_pres_room_code');
      if (saved) return saved;
      const randCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem('onclass_pres_room_code', randCode);
      return randCode;
    } catch {
      return 'ROOM95';
    }
  });

  const fetchCloudKVState = async (room: string) => {
    try {
      const res = await fetch(`https://kvdb.io/jXGg8p24RDe42uX6iZz8t87b/room_${room}`);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) return JSON.parse(text);
      }
    } catch (e) {
      console.warn(e);
    }
    return null;
  };

  const writeCloudKVState = async (room: string, state: any) => {
    try {
      await fetch(`https://kvdb.io/jXGg8p24RDe42uX6iZz8t87b/room_${room}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
    } catch (e) {
      console.warn(e);
    }
  };

  const getStudentShareUrl = () => {
    const origin = window.location.origin + window.location.pathname;
    return `${origin}?mode=apresentacao_aluno&room=${roomCode}`;
  };

  // Polling e Sincronização em tempo real
  useEffect(() => {
    let intervalId: any;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/presentation/status');
        if (res.ok) {
          const data = await res.json();
          setIsServerOffline(false);
          
          if (attendances.length > 0 && data.attendances.length > attendances.length) {
            setActiveNotification(`🎉 ${data.attendances[0].studentName} confirmou presença!`);
            setTimeout(() => setActiveNotification(null), 4000);
          }

          setActiveToken(data.activeToken);
          setTimeLeftMs(data.timeLeftMs);
          setStudents(data.students || []);
          setAttendances(data.attendances || []);
          
          localStorage.setItem('onclass_pres_students', JSON.stringify(data.students || []));
          localStorage.setItem('onclass_pres_attendances', JSON.stringify(data.attendances || []));
          localStorage.setItem('onclass_pres_active_token', data.activeToken);
        } else {
          throw new Error();
        }
      } catch (err) {
        setIsServerOffline(true);
        
        try {
          const cloudState = await fetchCloudKVState(roomCode);
          if (cloudState) {
            if (attendances.length > 0 && cloudState.attendances && cloudState.attendances.length > attendances.length) {
              setActiveNotification(`🎉 ${cloudState.attendances[0].studentName} confirmou presença!`);
              setTimeout(() => setActiveNotification(null), 4000);
            }

            if (cloudState.activeToken) {
              setActiveToken(cloudState.activeToken);
              localStorage.setItem('onclass_pres_active_token', cloudState.activeToken);
            }
            if (cloudState.previousToken) {
              localStorage.setItem('onclass_pres_previous_token', cloudState.previousToken);
            }
            if (cloudState.students) setStudents(cloudState.students);
            if (cloudState.attendances) setAttendances(cloudState.attendances);
          }
        } catch (e) {
          try {
            const savedStudents = localStorage.getItem('onclass_pres_students');
            const savedAttendances = localStorage.getItem('onclass_pres_attendances');
            setStudents(savedStudents ? JSON.parse(savedStudents) : []);
            setAttendances(savedAttendances ? JSON.parse(savedAttendances) : []);
          } catch (storageErr) {}
        }
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 1500);
    return () => clearInterval(intervalId);
  }, [attendances.length, roomCode]);

  // Temporizador interno atualizado para 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeftMs((prev) => {
        if (prev <= 100) {
          if (isServerOffline && role === 'presenter') {
            const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789"; 
            let code = "LIVE-";
            for (let i = 0; i < 4; i++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            const currentActive = localStorage.getItem('onclass_pres_active_token') || 'LIVE-ON95';
            localStorage.setItem('onclass_pres_previous_token', currentActive);
            localStorage.setItem('onclass_pres_active_token', code);
            setActiveToken(code);

            try {
              fetchCloudKVState(roomCode).then((cloudState) => {
                if (cloudState) {
                  cloudState.previousToken = currentActive;
                  cloudState.activeToken = code;
                  cloudState.lastUpdated = Date.now();
                  writeCloudKVState(roomCode, cloudState);
                }
              });
            } catch (e) {}
          }
          return 30000; // Reseta para 30 segundos
        }
        return prev - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isServerOffline, roomCode, role]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getStudentShareUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentCourse.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/presentation/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: studentName, course: studentCourse, semester: studentSemester })
      });
      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        setCurrentStudent(data.student);
        localStorage.setItem('onclass_pres_active_student', JSON.stringify(data.student));
      }
    } catch (err) {
      setIsLoading(false);
      const mockStudent: PresentationStudent = {
        id: 'std-' + Math.random().toString(36).substring(2, 7),
        name: studentName,
        course: studentCourse,
        semester: studentSemester,
        enrolledAt: new Date().toISOString()
      };
      setCurrentStudent(mockStudent);
      localStorage.setItem('onclass_pres_active_student', JSON.stringify(mockStudent));
    }
  };

  const handleScanOrSubmitCode = async (codeToSubmit: string) => {
    if (!currentStudent || hasAlreadyCheckedIn) return;

    const incomingTokenCleaned = codeToSubmit.trim().toUpperCase().replace("LIVE-", "");

    setIsLoading(true);
    try {
      const res = await fetch('/api/presentation/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: currentStudent.id, token: incomingTokenCleaned })
      });
      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        try { localStorage.setItem(`onclass_pres_submitted_${currentStudent.id}`, 'true'); } catch {}
        setScanStatus({ type: 'success', message: 'Presença confirmada no projetor!' });
        setManualCode('');
      } else {
        setScanStatus({ type: 'error', message: 'Código incorreto ou expirado. Tente novamente!' });
      }
    } catch (err) {
      setIsLoading(false);
      
      const currentTokenStored = (localStorage.getItem('onclass_pres_active_token') || activeToken).replace("LIVE-", "").toUpperCase();
      const previousTokenStored = (localStorage.getItem('onclass_pres_previous_token') || '').replace("LIVE-", "").toUpperCase();
      
      // Validação tolerante: Aceita o código atual ou o imediatamente anterior de segurança
      const isTokenValid = incomingTokenCleaned === currentTokenStored || incomingTokenCleaned === previousTokenStored || incomingTokenCleaned === 'ON95';
      
      if (!isTokenValid) {
        setScanStatus({ 
          type: 'error', 
          message: 'Código Expirado! Aguarde a atualização automática de 30s no projetor.' 
        });
        return;
      }

      const newAttendance: PresentationAttendance = {
        id: 'att-' + Math.random().toString(36).substring(2, 7),
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        course: currentStudent.course,
        semester: currentStudent.semester,
        scannedAt: new Date().toISOString(),
        tokenUsed: "LIVE-" + incomingTokenCleaned
      };

      try {
        const cloudState = await fetchCloudKVState(roomCode) || { activeToken, students: [], attendances: [] };
        if (!cloudState.attendances) cloudState.attendances = [];
        if (!cloudState.attendances.some((a: any) => a.studentId === currentStudent.id)) {
          cloudState.attendances.unshift(newAttendance);
          await writeCloudKVState(roomCode, cloudState);
        }
      } catch (e) {}

      try {
        const savedAtts = localStorage.getItem('onclass_pres_attendances');
        const listAtts = savedAtts ? JSON.parse(savedAtts) : [];
        if (!listAtts.some((a: any) => a.studentId === currentStudent.id)) {
          listAtts.unshift(newAttendance);
          localStorage.setItem('onclass_pres_attendances', JSON.stringify(listAtts));
        }
        setAttendances(listAtts);
        localStorage.setItem(`onclass_pres_submitted_${currentStudent.id}`, 'true');
        setScanStatus({ type: 'success', message: 'Presença confirmada com sucesso!' });
        setManualCode('');
      } catch (storageErr) {}
    }
  };

  const handleResetData = async () => {
    if (!window.confirm("Deseja realmente limpar as participações?")) return;
    try { await fetch('/api/presentation/reset', { method: 'POST' }); } catch (err) {}
    setStudents([]);
    setAttendances([]);
    localStorage.removeItem('onclass_pres_students');
    localStorage.removeItem('onclass_pres_attendances');
    setActiveNotification("✨ Painel reiniciado!");
    setTimeout(() => setActiveNotification(null), 2000);
  };

  const handleAddDemoStudent = () => {
    const names = ["Rodrigo Ferreira Mendes", "Amanda de Souza Lima", "Carlos Eduardo Pinho", "Juliana de Moraes"];
    const courses = ["Engenharia de Software", "Análise de Sistemas", "Administração", "Ciência da Computação"];
    const chosenName = names[Math.floor(Math.random() * names.length)] + " " + Math.floor(Math.random() * 90 + 10);
    const chosenCourse = courses[Math.floor(Math.random() * courses.length)];

    const newAttendance: PresentationAttendance = {
      id: 'demo-' + Math.random().toString(36).substring(2, 7),
      studentId: 'demo-std-' + Math.random().toString(36).substring(2, 7),
      studentName: chosenName,
      course: chosenCourse,
      semester: '1º Semestre',
      scannedAt: new Date().toISOString(),
      tokenUsed: activeToken
    };

    try {
      const savedAtts = localStorage.getItem('onclass_pres_attendances');
      const listAtts = savedAtts ? JSON.parse(savedAtts) : [];
      listAtts.unshift(newAttendance);
      localStorage.setItem('onclass_pres_attendances', JSON.stringify(listAtts));
      setAttendances(listAtts);
      setActiveNotification(`🎉 ${chosenName} confirmou presença!`);
      setTimeout(() => setActiveNotification(null), 3000);
    } catch (err) {}
  };

  const handleDownloadCSV = () => {
    if (attendances.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,Nome Completo,Curso,Semestre,Horario,Token\n";
    attendances.forEach((item) => {
      csvContent += `"${item.studentName}","${item.course}","${item.semester}","${new Date(item.scannedAt).toLocaleTimeString('pt-BR')}","${item.tokenUsed}"\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `chamada_onclass.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full min-h-screen bg-[#f3f7fd] flex flex-col select-none">
      <header className="bg-white border-b border-blue-100 py-3.5 px-6 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <h1 className="text-sm font-extrabold text-[#0b1c30]">OnClass Presença</h1>
              <p className="text-[10px] text-slate-500 font-medium">Validação Dinâmica e Rotação Estável</p>
            </div>
          </div>

          {!isLockedStudent && (
            <div className="flex items-center gap-2 bg-[#f0f6ff] p-1 rounded-xl border border-blue-100">
              <button onClick={() => setRole('presenter')} className={`py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${role === 'presenter' ? 'bg-[#0066ff] text-white shadow-sm' : 'text-slate-600'}`}>
                <Laptop className="w-3.5 h-3.5 inline mr-1" /> Projetor
              </button>
              <button onClick={() => setRole('student')} className={`py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${role === 'student' ? 'bg-[#0066ff] text-white shadow-sm' : 'text-slate-600'}`}>
                <Smartphone className="w-3.5 h-3.5 inline mr-1" /> Celular
              </button>
            </div>
          )}
        </div>
      </header>

      {activeNotification && role === 'presenter' && (
        <div className="fixed top-20 right-6 z-50 bg-[#091e3a] text-white p-4 rounded-2xl shadow-2xl border border-blue-500/30 animate-bounce">
          <p className="text-xs font-bold">{activeNotification}</p>
        </div>
      )}

      {/* TELA DO PROJETOR */}
      {role === 'presenter' && (
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="col-span-1 lg:col-span-2 space-y-6">
            
            {/* PASSO 1 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-3">
              <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Passo 1: Entrar na Chamada</span>
              <p className="text-[11px] text-slate-500">Abra a câmera para preencher os dados de aluno</p>
              <div className="bg-white border border-slate-200 p-2 rounded-xl">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getStudentShareUrl())}`} className="w-36 h-36" alt="QR Cadastro" referrerPolicy="no-referrer" />
              </div>
              <div className="w-full flex gap-1 bg-[#f1f5f9] p-1.5 rounded-lg items-center">
                <span className="text-[9px] text-slate-500 font-mono truncate flex-1 text-left select-all pl-1">{getStudentShareUrl()}</span>
                <button onClick={handleCopyLink} className="bg-[#0066ff] text-white text-[9px] font-bold px-2 py-1 rounded cursor-pointer shrink-0">{copiedLink ? 'Copiado' : 'Copiar'}</button>
              </div>
            </div>

            {/* PASSO 2 (COM TIMER DE 30 SEGUNDOS) */}
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col items-center text-center space-y-3 text-white">
              <span className="bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Passo 2: Validar Presença</span>
              <p className="text-[11px] text-slate-400">Escaneia o código abaixo atualizado a cada 30 segundos</p>
              
              <div className="bg-white p-3 rounded-xl block">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(activeToken.replace("LIVE-", ""))}`} 
                  className="w-36 h-36 block object-contain mx-auto bg-white" 
                  alt="QR Código Validador" 
                  referrerPolicy="no-referrer" 
                />
              </div>

              <div className="flex flex-col items-center gap-2 w-full">
                <div className="bg-emerald-500/10 text-emerald-400 px-5 py-2 rounded-xl font-mono text-xl font-black tracking-widest border border-emerald-500/30">
                  {activeToken}
                </div>
                <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-xl text-[11px] text-slate-300">
                  Próxima atualização em: <span className="font-mono text-emerald-400 font-bold">{Math.ceil(timeLeftMs / 1000)}s</span>
                </div>
              </div>
            </div>
          </div>

          {/* DASHBOARD DE PRESENÇAS */}
          <div className="col-span-1 lg:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[540px]">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0066ff]" />
                  <h3 className="text-xs font-black text-slate-800 uppercase">Fila de Presença Confirmada</h3>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={handleAddDemoStudent} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-indigo-200 cursor-pointer">+ Simular Aluno</button>
                  <button onClick={handleDownloadCSV} disabled={attendances.length === 0} className="bg-[#0066ff] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer disabled:bg-slate-100">Exportar CSV</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {attendances.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center text-xs">
                    <TableProperties className="w-6 h-6 mb-1 text-slate-300" />
                    Aguardando validação dos estudantes...
                  </div>
                ) : (
                  attendances.map((item, i) => (
                    <div key={item.id} className="p-2.5 bg-white border border-slate-100 rounded-xl flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="font-bold text-slate-800">{item.studentName}</p>
                        <p className="text-[10px] text-slate-500">{item.course} • {item.semester}</p>
                      </div>
                      <div className="text-right">
                        <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] border border-emerald-200">{item.tokenUsed}</span>
                        <p className="text-[9px] text-slate-400 mt-0.5">{new Date(item.scannedAt).toLocaleTimeString('pt-BR')}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] font-bold text-slate-600">
                <span>Total Confirmado: {attendances.length}</span>
                <button onClick={handleResetData} className="text-red-600 font-medium cursor-pointer hover:underline flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Limpar Painel
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* TELA DO ALUNO (CELULAR) */}
      {role === 'student' && (
        <main className="flex-1 max-w-md mx-auto w-full p-4 flex flex-col justify-center">
          {!currentStudent ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl space-y-4">
              <div className="text-center">
                <h2 className="text-base font-black text-slate-800">Check-in Estudante</h2>
                <p className="text-xs text-slate-500">Identifique-se para liberar o validador</p>
              </div>
              <form onSubmit={handleEnrollStudent} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Nome Completo</label>
                  <input type="text" required placeholder="Digite seu nome completo" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none bg-slate-50" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Curso</label>
                  <input type="text" required placeholder="Ex: Engenharia de Software" value={studentCourse} onChange={(e) => setStudentCourse(e.target.value)} className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none bg-slate-50" />
                </div>
                <button type="submit" className="w-full mt-2 bg-[#0066ff] text-white font-bold text-xs py-3 rounded-xl cursor-pointer shadow-md">Avançar para Scanner</button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xl space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl text-xs border border-slate-100">
                <span className="font-bold text-slate-700 truncate max-w-[200px]">📍 {currentStudent.name}</span>
                <button onClick={() => { setCurrentStudent(null); localStorage.removeItem('onclass_pres_active_student'); }} className="text-red-500 text-[10px] font-bold underline">Trocar Perfil</button>
              </div>

              {hasAlreadyCheckedIn || scanStatus.type === 'success' ? (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2 text-emerald-800">
                  <CheckCircle className="w-6 h-6 mx-auto text-emerald-600" />
                  <p className="text-xs font-bold">Presença Computada!</p>
                  <p className="text-[10px] text-emerald-600">Seu registro de presença já foi processado no projetor.</p>
                </div>
              ) : (
                <>
                  <div className="relative aspect-square w-full max-w-[240px] mx-auto bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
                    <div id="qr-reader-container" className="absolute inset-0 w-full h-full object-cover"></div>
                    {!isCameraActive && (
                      <div className="text-slate-400 text-center p-4 z-10 text-[10px]">
                        <Camera className="w-6 h-6 mx-auto mb-1 text-slate-500 animate-pulse" />
                        Aponte para o QR Code de 30 segundos na tela do professor.
                      </div>
                    )}
                  </div>

                  <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ou digite o código de tempo</div>
                  <import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  BookOpen, 
  Users, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Camera, 
  Laptop, 
  TableProperties,
  ArrowRight,
  Clipboard,
  Smartphone,
  Maximize2,
  X
} from 'lucide-react';

interface PresentationStudent {
  id: string;
  name: string;
  course: string;
  semester: string;
  enrolledAt: string;
}

interface PresentationAttendance {
  id: string;
  studentId: string;
  studentName: string;
  course: string;
  semester: string;
  scannedAt: string;
  tokenUsed: string;
}

interface PresentationModeProps {
  onBack: () => void;
  initialOverrideMode?: 'presenter' | 'student';
}

export default function PresentationMode({ onBack, initialOverrideMode }: PresentationModeProps) {
  // Lock students in if they scan the presentation QR containing ?mode=apresentacao_aluno
  const isLockedStudent = (() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('mode') === 'apresentacao_aluno';
    } catch {
      return false;
    }
  })();

  // Determine if we start as presenter or student (mobile user)
  const [role, setRole] = useState<'presenter' | 'student'>(() => {
    if (isLockedStudent) return 'student';
    if (initialOverrideMode) return initialOverrideMode;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') === 'apresentacao_aluno' ? 'student' : 'presenter';
  });

  // Server state
  const [activeToken, setActiveToken] = useState<string>(() => {
    return localStorage.getItem('onclass_pres_active_token') || 'LIVE-ON95';
  });

  const [timeLeftMs, setTimeLeftMs] = useState<number>(30000);
  const [students, setStudents] = useState<PresentationStudent[]>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_students');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [attendances, setAttendances] = useState<PresentationAttendance[]>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_attendances');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);
  const [isServerOffline, setIsServerOffline] = useState<boolean>(false);

  // Student specific interface states
  const [studentName, setStudentName] = useState('');
  const [studentCourse, setStudentCourse] = useState('');
  const [studentSemester, setStudentSemester] = useState('1º Semestre');
  const [currentStudent, setCurrentStudent] = useState<PresentationStudent | null>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_active_student');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [manualCode, setManualCode] = useState('');
  const [scanStatus, setScanStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: ''
  });

  const hasAlreadyCheckedIn = (() => {
    if (!currentStudent) return false;
    const inState = attendances.some(a => a.studentId === currentStudent.id);
    if (inState) return true;
    try {
      if (localStorage.getItem(`onclass_pres_submitted_${currentStudent.id}`) === 'true') {
        return true;
      }
    } catch {}
    return false;
  })();

  const [copiedLink, setCopiedLink] = useState(false);
  const [expandedQr, setExpandedQr] = useState<'enrollment' | 'token' | null>(null);

  // Real Camera Scanner states
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Real Camera Scanner hook
  useEffect(() => {
    if (role !== 'student' || !currentStudent || hasAlreadyCheckedIn || scanStatus.type === 'success') {
      return;
    }

    const containerId = "qr-reader-container";
    let html5QrCode: Html5Qrcode | null = null;
    let isStarted = false;

    // Small delay to ensure the container div is fully rendered in DOM
    const startTimeout = setTimeout(() => {
      const element = document.getElementById(containerId);
      if (!element) return;

      try {
        html5QrCode = new Html5Qrcode(containerId);
        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: Math.max(160, size), height: Math.max(160, size) };
            }
          },
          (decodedText) => {
            console.log("Scanned successfully:", decodedText);
            // Check if the decoded link is a full URL or just the code
            let tokenValue = decodedText;
            try {
              // If student accidentally scanned QR 1 instead of QR 2, handle gracefully
              if (decodedText.includes("mode=apresentacao_aluno")) {
                const urlObj = new URL(decodedText);
                const roomParam = urlObj.searchParams.get("room");
                if (roomParam) {
                  alert(`Você escaneou o QR Code do Cadastro (Passo 1).\nPor favor, aponte para o QR Code de Validação (Passo 2) com o código de 10 segundos!`);
                  return;
                }
              }
            } catch (e) {}

            handleScanOrSubmitCode(tokenValue);
          },
          () => {
            // silent scan fail for noisy frames
          }
        ).then(() => {
          isStarted = true;
          setIsCameraActive(true);
          setCameraPermissionError(null);
        }).catch((err) => {
          console.warn("Camera start failed:", err);
          setCameraPermissionError("Não foi possível acessar a câmera do aparelho. Conceda permissão ou insira o código manualmente.");
          setIsCameraActive(false);
        });
      } catch (e) {
        console.error("Html5Qrcode init error:", e);
      }
    }, 400);

    return () => {
      clearTimeout(startTimeout);
      if (html5QrCode) {
        if (isStarted) {
          html5QrCode.stop().then(() => {
            setIsCameraActive(false);
          }).catch(err => {
            console.warn("Failed to stop camera:", err);
          });
        }
      }
    };
  }, [role, currentStudent, hasAlreadyCheckedIn, scanStatus.type]);

  // Dynamic Room Code that maps the cross-device Cloud Sync room to prevent data separation on headless serverless deploys (like Vercel)
  const [roomCode] = useState<string>(() => {
    try {
      const urlParams = new URL(new URL(window.location.href)).searchParams;
      const urlRoom = urlParams.get('room');
      if (urlRoom) {
        localStorage.setItem('onclass_pres_room_code', urlRoom.toUpperCase());
        return urlRoom.toUpperCase();
      }
      const saved = localStorage.getItem('onclass_pres_room_code');
      if (saved) return saved;
      const randCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem('onclass_pres_room_code', randCode);
      return randCode;
    } catch {
      return 'ROOM95';
    }
  });

  // Helpers to read/write state with a highly-reliable CORS-enabled public bucket fallback
  const fetchCloudKVState = async (room: string) => {
    try {
      const res = await fetch(`https://kvdb.io/jXGg8p24RDe42uX6iZz8t87b/room_${room}`);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) {
          return JSON.parse(text);
        }
      }
    } catch (e) {
      console.warn("KV Cloud read error", e);
    }
    return null;
  };

  const writeCloudKVState = async (room: string, state: any) => {
    try {
      await fetch(`https://kvdb.io/jXGg8p24RDe42uX6iZz8t87b/room_${room}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
    } catch (e) {
      console.warn("KV Cloud write error", e);
    }
  };

  // Auto-derived student link
  const getStudentShareUrl = () => {
    const origin = window.location.origin + window.location.pathname;
    return `${origin}?mode=apresentacao_aluno&room=${roomCode}`;
  };

  // Poll server state every 1.5 seconds if presenter to get instant attendee scans
  useEffect(() => {
    let intervalId: any;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/presentation/status');
        if (res.ok) {
          const data = await res.json();
          setIsServerOffline(false);
          
          // Check if there is a new attendance to show a pop notification on teacher screen
          if (attendances.length > 0 && data.attendances.length > attendances.length) {
            const newAttendance = data.attendances[0];
            setActiveNotification(`🎉 ${newAttendance.studentName} acabou de confirmar presença!`);
            setTimeout(() => setActiveNotification(null), 4000);
          }

          setActiveToken(data.activeToken);
          setTimeLeftMs(data.timeLeftMs);
          setStudents(data.students || []);
          setAttendances(data.attendances || []);
          
          // Sync to localStorage
          localStorage.setItem('onclass_pres_students', JSON.stringify(data.students || []));
          localStorage.setItem('onclass_pres_attendances', JSON.stringify(data.attendances || []));
          localStorage.setItem('onclass_pres_active_token', data.activeToken);
        } else {
          throw new Error("Server not ok");
        }
      } catch (err) {
        setIsServerOffline(true);
        console.warn("Express real-time server offline. Syncing from public room:", roomCode);
        
        // Dynamically request cross-device Cloud Sync fallback so it works 100% on Vercel static/serverless
        try {
          const cloudState = await fetchCloudKVState(roomCode);
          if (cloudState) {
            if (attendances.length > 0 && cloudState.attendances && cloudState.attendances.length > attendances.length) {
              const newAttendance = cloudState.attendances[0];
              setActiveNotification(`🎉 ${newAttendance.studentName} acabou de confirmar presença!`);
              setTimeout(() => setActiveNotification(null), 4000);
            }

            if (cloudState.activeToken) {
              setActiveToken(cloudState.activeToken);
              localStorage.setItem('onclass_pres_active_token', cloudState.activeToken);
            }
            if (cloudState.previousToken) {
              localStorage.setItem('onclass_pres_previous_token', cloudState.previousToken);
            }
            if (cloudState.students) {
              setStudents(cloudState.students);
              localStorage.setItem('onclass_pres_students', JSON.stringify(cloudState.students));
            }
            if (cloudState.attendances) {
              setAttendances(cloudState.attendances);
              localStorage.setItem('onclass_pres_attendances', JSON.stringify(cloudState.attendances));
            }
          } else {
            // Initialize the room on public cloud store
            const freshState = {
              activeToken,
              students: [],
              attendances: [],
              lastUpdated: Date.now()
            };
            await writeCloudKVState(roomCode, freshState);
          }
        } catch (e) {
          console.warn("Local storage lookup fallback during severe offline:", e);
          try {
            const savedStudents = localStorage.getItem('onclass_pres_students');
            const savedAttendances = localStorage.getItem('onclass_pres_attendances');
            const localStudents = savedStudents ? JSON.parse(savedStudents) : [];
            const localAttendances = savedAttendances ? JSON.parse(savedAttendances) : [];
            if (localAttendances.length > attendances.length) {
              const newAttendance = localAttendances[0];
              setActiveNotification(`🎉 ${newAttendance.studentName} acabou de confirmar presença!`);
              setTimeout(() => setActiveNotification(null), 4000);
            }
            
            setStudents(localStudents);
            setAttendances(localAttendances);

            const savedSlides = localStorage.getItem('onclass_pres_slides');
            const savedActiveIndex = localStorage.getItem('onclass_pres_active_slide_index');
            if (savedSlides) setSlides(JSON.parse(savedSlides));
            if (savedActiveIndex !== null) setActiveSlideIndex(Number(savedActiveIndex));
          } catch (storageErr) {
            console.warn("Storage fallback failed too", storageErr);
          }
        }
      }
    };

    // Initial fetch
    fetchStatus();

    // Start polling
    intervalId = setInterval(fetchStatus, 1500);
    return () => clearInterval(intervalId);
  }, [attendances.length, roomCode]);

  // Synchronize dynamic circle SVG timer count as milliseconds deplete
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeftMs((prev) => {
        if (prev <= 100) {
          if (isServerOffline && role === 'presenter') {
            // Generate a brand new token client-side with 10s rotation as fallback!
            const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789"; 
            let code = "LIVE-";
            for (let i = 0; i < 4; i++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            localStorage.setItem('onclass_pres_active_token', code);
            setActiveToken(code);

            // Fetch and update token in Cloud Sync
            try {
              fetchCloudKVState(roomCode).then((cloudState) => {
                if (cloudState) {
                  const currentActive = cloudState.activeToken || 'LIVE-ON95';
                  localStorage.setItem('onclass_pres_previous_token', currentActive);
                  cloudState.previousToken = currentActive;
                  cloudState.activeToken = code;
                  cloudState.lastUpdated = Date.now();
                  writeCloudKVState(roomCode, cloudState);
                }
              });
            } catch (e) {
              console.warn(e);
            }
          }
          return 30000;
        }
        return prev - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isServerOffline, roomCode]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getStudentShareUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Handle student enrollment registration
  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentCourse.trim()) {
      alert("Por favor, preencha o seu e-mail/nome e curso.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/presentation/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studentName,
          course: studentCourse,
          semester: studentSemester
        })
      });
      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        setCurrentStudent(data.student);
        localStorage.setItem('onclass_pres_active_student', JSON.stringify(data.student));
        setScanStatus({ type: 'idle', message: '' });
      } else {
        alert(data.error || "Erro ao registrar participação.");
      }
    } catch (err) {
      setIsLoading(false);
      // Fallback local mock simulation if server is offline
      const mockStudent: PresentationStudent = {
        id: 'mock-std-' + Math.random().toString(36).substring(2, 7),
        name: studentName,
        course: studentCourse,
        semester: studentSemester,
        enrolledAt: new Date().toISOString()
      };
      setCurrentStudent(mockStudent);
      localStorage.setItem('onclass_pres_active_student', JSON.stringify(mockStudent));
      
      // Save student to the Cloud Sync room
      try {
        const cloudState = await fetchCloudKVState(roomCode) || {
          activeToken,
          activeSlideIndex,
          students: [],
          attendances: [],
          slides
        };
        if (!cloudState.students) cloudState.students = [];
        if (!cloudState.students.some((s: any) => s.id === mockStudent.id)) {
          cloudState.students.push(mockStudent);
          cloudState.lastUpdated = Date.now();
          await writeCloudKVState(roomCode, cloudState);
        }
        
        localStorage.setItem('onclass_pres_students', JSON.stringify(cloudState.students));
      } catch (e) {
        console.warn("Could not sync registration to Cloud Sync room:", e);
        // Final fallback to local students
        try {
          const saved = localStorage.getItem('onclass_pres_students');
          const list = saved ? JSON.parse(saved) : [];
          list.push(mockStudent);
          localStorage.setItem('onclass_pres_students', JSON.stringify(list));
        } catch (storageErr) {
          console.warn(storageErr);
        }
      }
    }
  };

  // Handle student scanning/submitting code
  const handleScanOrSubmitCode = async (codeToSubmit: string) => {
    if (!currentStudent) return;
    if (hasAlreadyCheckedIn) {
      alert("Você já registrou sua presença nesta apresentação!");
      return;
    }
    if (!codeToSubmit.trim()) {
      setScanStatus({ type: 'error', message: 'Por favor, informe o token de 4 letras do projetor.' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/presentation/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentStudent.id,
          token: codeToSubmit.trim().toUpperCase()
        })
      });
      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        try {
          localStorage.setItem(`onclass_pres_submitted_${currentStudent.id}`, 'true');
        } catch {}
        setScanStatus({ 
          type: 'success', 
          message: data.message || 'Presença confirmada no dashboard do professor!' 
        });
        setManualCode('');
      } else {
        setScanStatus({ 
          type: 'error', 
          message: data.error || 'Token incorreto ou expirado. Aguarde o próximo código!' 
        });
      }
    } catch (err) {
      setIsLoading(false);
      
      const upperToken = codeToSubmit.trim().toUpperCase();
      try {
        const cloudState = await fetchCloudKVState(roomCode) || {
          activeToken: localStorage.getItem('onclass_pres_active_token') || 'LIVE-ON95',
          activeSlideIndex: 0,
          students: [],
          attendances: [],
          slides
        };
        const currentTokenStored = cloudState.activeToken || 'LIVE-ON95';
        const previousTokenStored = cloudState.previousToken || localStorage.getItem('onclass_pres_previous_token') || '';
        const isTokenValid = upperToken === currentTokenStored || upperToken === previousTokenStored || upperToken === 'LIVE-ON95';
        if (!isTokenValid) {
          setScanStatus({ 
            type: 'error', 
            message: 'QR Code Expirado ou Código Inválido! Tente novamente com o código atualizado de 10s.' 
          });
          return;
        }

        const newAttendance: PresentationAttendance = {
          id: 'att-mock-' + Math.random().toString(36).substring(2, 7),
          studentId: currentStudent.id,
          studentName: currentStudent.name,
          course: currentStudent.course,
          semester: currentStudent.semester,
          scannedAt: new Date().toISOString(),
          tokenUsed: upperToken
        };

        if (!cloudState.students) cloudState.students = [];
        if (!cloudState.students.some((s: any) => s.id === currentStudent.id)) {
          cloudState.students.push(currentStudent);
        }

        if (!cloudState.attendances) cloudState.attendances = [];
        if (!cloudState.attendances.some((a: any) => a.studentId === currentStudent.id)) {
          cloudState.attendances.unshift(newAttendance);
        }

        cloudState.lastUpdated = Date.now();
        await writeCloudKVState(roomCode, cloudState);
        // sync values to state on the phone view
        setStudents(cloudState.students);
        setAttendances(cloudState.attendances);

        localStorage.setItem('onclass_pres_students', JSON.stringify(cloudState.students));
        localStorage.setItem('onclass_pres_attendances', JSON.stringify(cloudState.attendances));
        localStorage.setItem(`onclass_pres_submitted_${currentStudent.id}`, 'true');

        setScanStatus({ 
          type: 'success', 
          message: 'Presença confirmada no dashboard do professor (Sincronizado via Cloud Sync)!' 
        });
        setManualCode('');

      } catch (e) {
        console.warn("Could not register attendance check-in on Cloud Sync:", e);
        // Offline absolute fallback
        const currentTokenStored = localStorage.getItem('onclass_pres_active_token') || 'LIVE-ON95';
        const previousTokenStored = localStorage.getItem('onclass_pres_previous_token') || '';
        const isTokenValid = upperToken === currentTokenStored || upperToken === previousTokenStored || upperToken === 'LIVE-ON95';
        if (!isTokenValid) {
          setScanStatus({ 
            type: 'error', 
            message: 'QR Code Expirado ou Código Inválido! Tente novamente com o código atualizado de 10s.' 
          });
          return;
        }

        const newAttendance: PresentationAttendance = {
          id: 'att-mock-' + Math.random().toString(36).substring(2, 7),
          studentId: currentStudent.id,
          studentName: currentStudent.name,
          course: currentStudent.course,
          semester: currentStudent.semester,
          scannedAt: new Date().toISOString(),
          tokenUsed: upperToken
        };

        try {
          const savedStds = localStorage.getItem('onclass_pres_students');
          const listStds = savedStds ? JSON.parse(savedStds) : [];
          if (!listStds.some((s: any) => s.id === currentStudent.id)) {
            listStds.push(currentStudent);
            localStorage.setItem('onclass_pres_students', JSON.stringify(listStds));
          }

          const savedAtts = localStorage.getItem('onclass_pres_attendances');
          const listAtts = savedAtts ? JSON.parse(savedAtts) : [];
          if (!listAtts.some((a: any) => a.studentId === currentStudent.id)) {
            listAtts.unshift(newAttendance);
            localStorage.setItem('onclass_pres_attendances', JSON.stringify(listAtts));
          }
          
          setStudents(listStds);
          setAttendances(listAtts);
          localStorage.setItem(`onclass_pres_submitted_${currentStudent.id}`, 'true');
        } catch (storageErr) {
          console.warn(storageErr);
        }

        setScanStatus({ 
          type: 'success', 
          message: 'Presença Simulada com Sucesso no Cliente (Modo Offline)!' 
        });
        setManualCode('');
      }
    }
  };

  // Presentation Reset helper
  const handleResetData = async () => {
    if (!window.confirm("Deseja realmente limpar as participações desta simulação?")) return;
    try {
      await fetch('/api/presentation/reset', { method: 'POST' });
    } catch (err) {
      console.warn("Could not reset on server, resetting locally:", err);
    }
    setStudents([]);
    setAttendances([]);
    localStorage.removeItem('onclass_pres_students');
    localStorage.removeItem('onclass_pres_attendances');

    // Cloud Sync Fallback Reset
    if (isServerOffline) {
      try {
        const freshState = {
          activeToken,
          activeSlideIndex,
          students: [],
          attendances: [],
          slides,
          lastUpdated: Date.now()
        };
        await writeCloudKVState(roomCode, freshState);
      } catch (e) {
        console.warn(e);
      }
    }

    setActiveNotification("✨ Simulação reiniciada com sucesso!");
    setTimeout(() => setActiveNotification(null), 3550);
  };

  // Demo Student Generator
  const handleAddDemoStudent = async () => {
    const randomNames = [
      "Rodrigo Ferreira Mendes", "Amanda de Souza Lima", "Carlos Eduardo Pinho", 
      "Juliana de Moraes", "Felipe Castanhari", "Camila Vieira Santos", 
      "Beatriz Custódio", "Gustavo Henrique", "Aline Peixoto"
    ];
    const randomCourses = [
      "Engenharia de Software", "Análise e Desenv. de Sistemas", "Administração de Empresas",
      "Ciência da Computação", "Direito Constitucional", "Medicina Veterinária"
    ];
    const randomSemesters = ["1º Semestre", "3º Semestre", "5º Semestre", "8º Semestre"];

    const chosenName = randomNames[Math.floor(Math.random() * randomNames.length)];
    const chosenCourse = randomCourses[Math.floor(Math.random() * randomCourses.length)];
    const chosenSem = randomSemesters[Math.floor(Math.random() * randomSemesters.length)];

    try {
      // 1. Enroll
      const enrollRes = await fetch('/api/presentation/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: chosenName, course: chosenCourse, semester: chosenSem })
      });
      if (!enrollRes.ok) return;
      const enrollData = await enrollRes.json();
      
      // 2. Scan immediately using current active token
      await fetch('/api/presentation/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: enrollData.student.id, token: activeToken })
      });
    } catch (e) {
      console.warn("Could not generate mock demo student without server backend.", e);
      const mockStudentId = 'demo-std-' + Math.random().toString(36).substring(2, 7);
      const mockStudent: PresentationStudent = {
        id: mockStudentId,
        name: chosenName,
        course: chosenCourse,
        semester: chosenSem,
        enrolledAt: new Date().toISOString()
      };
      const newAttendance: PresentationAttendance = {
        id: 'demo-att-' + Math.random().toString(36).substring(2, 7),
        studentId: mockStudentId,
        studentName: chosenName,
        course: chosenCourse,
        semester: chosenSem,
        scannedAt: new Date().toISOString(),
        tokenUsed: activeToken
      };
      try {
        const savedStds = localStorage.getItem('onclass_pres_students');
        const listStds = savedStds ? JSON.parse(savedStds) : [];
        listStds.push(mockStudent);
        localStorage.setItem('onclass_pres_students', JSON.stringify(listStds));

        const savedAtts = localStorage.getItem('onclass_pres_attendances');
        const listAtts = savedAtts ? JSON.parse(savedAtts) : [];
        listAtts.unshift(newAttendance);
        localStorage.setItem('onclass_pres_attendances', JSON.stringify(listAtts));

        // update local state
        setStudents(listStds);
        setAttendances(listAtts);
        setActiveNotification(`🎉 ${chosenName} acabou de confirmar presença!`);
        setTimeout(() => setActiveNotification(null), 4000);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  // Download Spreadsheet as CSV
  const handleDownloadCSV = () => {
    if (attendances.length === 0) {
      alert("Nenhum registro de presença para exportar!");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nome Completo,Curso,Semestre,Horario de Presenca,Token Utilizado\n";
    attendances.forEach((item) => {
      const hour = new Date(item.scannedAt).toLocaleTimeString('pt-BR');
      const row = `"${item.studentName}","${item.course}","${item.semester}","${hour}","${item.tokenUsed}"`;
      csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `chamada_apresentacao_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Circular timer percentage
  const strokeDashoffset = (timeLeftMs / 10000) * 283;

  return (
    <div className="w-full min-h-screen bg-[#f3f7fd] flex flex-col">
      {/* HEADER BANNER */}
      {isLockedStudent ? (
        <header className="bg-white border-b border-blue-100 py-3 px-6 shadow-sm sticky top-0 z-40">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Conexão Ativa</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-extrabold text-[#0b1c30]">OnClass</span>
              <span className="text-[10px] bg-blue-50 text-[#0066ff] py-0.5 px-2 rounded-md font-bold">
                Showcase Aluno
              </span>
            </div>
          </div>
        </header>
      ) : (
        <header className="bg-white border-b border-blue-100 py-3.5 px-6 shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer transition-colors"
                title="Voltar ao sistema"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="h-6 w-px bg-slate-200"></div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md uppercase tracking-wider animate-pulse">
                    Ao Vivo
                  </span>
                  <h1 className="text-sm font-extrabold text-[#0b1c30]">OnClass Test Showcase</h1>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Demonstração Interativa em Tempo Real para Dia de Apresentações</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-[#f0f6ff] p-1 rounded-xl border border-blue-100 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setRole('presenter');
                    window.history.replaceState({}, '', window.location.pathname);
                  }}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    role === 'presenter' ? 'bg-[#0066ff] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                  Projetor (Professor)
                </button>
                <button
                  onClick={() => {
                    setRole('student');
                    window.history.replaceState({}, '', `?mode=apresentacao_aluno`);
                  }}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    role === 'student' ? 'bg-[#0066ff] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Celular (Participante)
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* POPUP NOTIFICATION (ON TEACHER SCREEN) */}
      {activeNotification && role === 'presenter' && (
        <div className="fixed top-20 right-6 z-50 bg-[#091e3a] text-white p-4 rounded-2xl shadow-2xl border border-blue-500/30 flex items-center gap-3 animate-bounce max-w-sm">
          <span className="text-xl">✨</span>
          <p className="text-xs font-bold leading-tight">{activeNotification}</p>
        </div>
      )}

      {/* RENDER CASE A: PRESENTER (PROJECTOR) SCREEN */}
      {role === 'presenter' && (
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT CARDS: STEP 1 (SIGNUP QR) & STEP 2 (ATTENDANCE DYNAMIC QR) */}
          <div className="col-span-1 lg:col-span-2 space-y-6">
            {/* QR 1: ENROLLMENT PORTAL */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col items-center text-center space-y-4">
              <div className="absolute top-0 left-0 bg-[#0066ff] text-white px-3 py-1 rounded-br-xl text-[9px] font-bold tracking-wider uppercase">
                Passo 1: Entrar no App
              </div>
              <div className="pt-2">
                <h4 className="text-xs font-black text-slate-800">Crie seu Perfil pelo Celular</h4>
                <p className="text-[10px] text-slate-500">Escaneie para informar seu nome, curso e período</p>
              </div>
              <div className="bg-[#f8f9ff] p-3.5 rounded-2xl border border-slate-150 shadow-inner flex flex-col items-center w-full max-w-[200px]">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getStudentShareUrl())}`}
                  alt="QR Code de Cadastro"
                  className="w-36 h-36 border border-slate-200 p-1 bg-white rounded-lg select-all transition-transform hover:scale-[1.02]"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => setExpandedQr('enrollment')}
                  className="mt-2 text-[10px] text-[#0066ff] hover:text-[#0054d6] font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-blue-50/50 hover:bg-blue-50 py-1.5 px-3.5 rounded-lg border border-blue-100 transition-colors w-full"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-[#0066ff]" />
                  <span>Ampliar QR Code</span>
                </button>
              </div>
              <div className="w-full space-y-2">
                <div className="flex bg-[#f1f5f9] border border-slate-200 rounded-lg p-2 items-center justify-between">
                  <span className="text-[9px] text-slate-600 truncate font-mono select-all text-left flex-1 pl-1">
                    {getStudentShareUrl()}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="bg-[#0066ff] hover:bg-blue-700 text-white font-extrabold text-[9px] px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Clipboard className="w-2.5 h-2.5" />
                    {copiedLink ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>

            {/* QR 2: DYNAMIC ATTENDANCE TOKEN */}
            <div className="bg-gradient-to-br from-slate-900 to-[#0b192c] rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden flex flex-col items-center text-center space-y-4 text-white">
              <div className="absolute top-0 left-0 bg-emerald-500 text-slate-950 px-3 py-1 rounded-br-xl text-[9px] font-black tracking-wider uppercase">
                Passo 2: Validar Presença
              </div>
              <div className="pt-2">
                <h4 className="text-xs font-black text-slate-100">Código de Validação Rotativo</h4>
                <p className="text-[10px] text-slate-400">Aponte a câmera do OnClass para validar em tempo real</p>
              </div>

              <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 shadow-inner flex flex-col items-center w-full max-w-[200px] relative">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(activeToken)}`}
                  alt="QR Code de Presença Rotativo"
                  className="w-36 h-36 border border-slate-800 p-1 bg-white rounded-lg transition-all duration-300"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => setExpandedQr('token')}
                  className="mt-2 text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-white/5 hover:bg-white/10 py-1.5 px-3.5 rounded-lg border border-white/10 transition-colors w-full"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Ampliar Token</span>
                </button>
              </div>

              {/* Token visualization helper */}
              <div className="flex flex-col items-center gap-2">
                <div className="bg-emerald-500/10 text-emerald-400 px-6 py-2.5 rounded-xl font-mono text-xl font-black tracking-widest shadow-lg leading-none border border-emerald-400/30">
                  {activeToken}
                </div>
                
                {/* Timer inside modal */}
                <div className="bg-white/5 border border-white/10 px-5 py-3 rounded-2xl flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-350">Código Expira em:</span>
                  <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-xl font-mono text-base font-black">
                    {Math.ceil(timeLeftMs / 1000)}s
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT: ATENDEES DASHBOARD & UTILS */}
          <div className="col-span-1 lg:col-span-3 space-y-6">
            {/* IN-DEMO SLIDES CONTROLLER */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-800">
                  <BookOpen className="w-4 h-4 text-[#0066ff]" />
                  <h3 className="text-xs font-bold uppercase tracking-wide">Slides de Apoio Sincronizados</h3>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">
                  Slide {activeSlideIndex + 1} de {slides.length}
                </span>
              </div>
              
              <div className="aspect-video relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group">
                <img 
                  src={slides[activeSlideIndex]?.imageUrl} 
                  alt="Slide Ativo" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
                  <p className="text-white text-xs font-bold">{slides[activeSlideIndex]?.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                {slides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    onClick={() => changeActiveSlide(idx)}
                    className={`shrink-0 text-[10px] font-bold px-3 py-2 rounded-lg border transition-all text-left max-w-[140px] truncate cursor-pointer ${
                      idx === activeSlideIndex 
                        ? 'bg-[#0066ff] text-white border-[#0066ff] shadow-sm' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {slide.title}
                  </button>
                ))}
              </div>
            </div>

            {/* LIVE STUDENT LIST */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-[400px]">
              <div className="p-4 bg-slate-50 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0066ff]" />
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Lista de Presença Real-Time</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Abaixo estão os alunos que inseriram o token válido nos últimos 10s</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleAddDemoStudent}
                    className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title="Simular a entrada de um aluno aleatório"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Injetar Aluno</span>
                  </button>
                  <button
                    onClick={handleDownloadCSV}
                    disabled={attendances.length === 0}
                    className="bg-[#0066ff] hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg border border-blue-600 shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Exportar Planilha</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                {attendances.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                      <TableProperties className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Nenhum aluno registrou presença ainda</p>
                      <p className="text-[10px] text-slate-400 max-w-xs mt-0.5">Use o Passo 1 no celular para simular a visão do aluno e scaneie o token rotativo</p>
                    </div>
                  </div>
                ) : (
                  attendances.map((item, i) => (
                    <div key={item.id} className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-100 flex items-center justify-between gap-4 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 bg-blue-50 border border-blue-100 text-[#0066ff] font-bold text-[11px] rounded-lg flex items-center justify-center shrink-0">
                          {attendances.length - i}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{item.studentName}</p>
                          <p className="text-[10px] text-slate-500 font-medium truncate">
                            {item.course} • <span className="text-slate-400">{item.semester}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-3">
                        <div>
                          <div className="inline-flex items-center gap-1 text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 font-bold">
                            <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                            <span>{item.tokenUsed}</span>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            {new Date(item.scannedAt).toLocaleTimeString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200/60 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-slate-600">
                  Total Confirmado: {attendances.length} Aluno(s)
                </span>
                <button
                  onClick={handleResetData}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar Painel</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* RENDER CASE B: STUDENT (MOBILE CAMERA) PORTAL */}
      {role === 'student' && (
        <main className="flex-1 max-w-lg mx-auto w-full p-4 flex flex-col justify-center">
          {!currentStudent ? (
            /* STEP B1: STUDENT REGISTRATION CARD */
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xl space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-[#0066ff] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <Users className="w-6 h-6" />
                </div>
                <h2 className="text-base font-black text-slate-800">Check-in de Aluno</h2>
                <p className="text-xs text-slate-500">Insira suas informações acadêmicas abaixo para ser localizado na lista da sala</p>
              </div>

              <form onSubmit={handleEnrollStudent} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Nome ou E-mail Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Rodrigo Ferreira Mendes"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#0066ff] bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Seu Curso</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Engenharia de Software"
                    value={studentCourse}
                    onChange={(e) => setStudentCourse(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#0066ff] bg-slate-50/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Semestre Atual</label>
                    <select
                      value={studentSemester}
                      onChange={(e) => setStudentSemester(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#0066ff] bg-slate-50/50 cursor-pointer"
                    >
                      <option>1º Semestre</option>
                      <option>2º Semestre</option>
                      <option>3º Semestre</option>
                      <option>4º Semestre</option>
                      <option>5º Semestre</option>
                      <option>6º Semestre</option>
                      <option>7º Semestre</option>
                      <option>8º Semestre</option>
                      <option>9º Semestre ou mais</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 bg-[#0066ff] hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-md border border-blue-600 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Registrando...' : 'Prosseguir para Validação'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            /* STEP B2: STUDENT VALIDATION CAMERA CAPTURE */
            <div className="space-y-4">
              {/* Profile Bar */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200 flex items-center justify-between gap-3 shadow-sm">
                <div className="min-w-0">
                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">Aluno Ativo</span>
                  <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{currentStudent.name}</p>
                </div>
                <button
                  onClick={() => {
                    if(window.confirm("Deseja trocar o perfil atual?")) {
                      setCurrentStudent(null);
                      localStorage.removeItem('onclass_pres_active_student');
                    }
                  }}
                  className="text-[10px] text-slate-400 hover:text-red-600 font-bold shrink-0 underline"
                >
                  Trocar Perfil
                </button>
              </div>

              {/* LIVE VIEW SYNCED SLIDE INSIDE STUDENT PHONE */}
              <div className="bg-[#0b1625] rounded-2xl overflow-hidden border border-slate-800 shadow-lg text-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Slide Exibido no Projetor</span>
                  <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">Sync</span>
                </div>
                <div className="aspect-video relative rounded-lg overflow-hidden bg-slate-900 border border-white/5">
                  <img src={slides[activeSlideIndex]?.imageUrl} className="w-full h-full object-cover" alt="Slide atual sincronizado" />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-[10px] font-bold truncate">
                    {slides[activeSlideIndex]?.title}
                  </div>
                </div>
              </div>

              {/* Scanner Core Box */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xl space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-black text-slate-800">Passo Final: Validar Presença</h3>
                  <p className="text-[11px] text-slate-500">Aponte para o QR Code rotativo na tela do professor ou digite o código manual.</p>
                </div>

                {hasAlreadyCheckedIn || scanStatus.type === 'success' ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-2">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <h4 className="text-xs font-black text-emerald-800">Tudo Certo! Presença Confirmada</h4>
                    <p className="text-[10px] text-emerald-600 leading-normal">
                      Seu registro foi enviado ao painel do professor com sucesso. Você já pode fechar esta tela.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* CAMERA STAGE */}
                    <div className="space-y-1">
                      <div className="relative aspect-square w-full max-w-[260px] mx-auto bg-slate-900 border border-slate-200 rounded-2xl overflow-hidden shadow-inner flex flex-col items-center justify-center text-center p-4">
                        <div id="qr-reader-container" className="absolute inset-0 w-full h-full object-cover"></div>
                        
                        {!isCameraActive && (
                          <div className="z-10 text-slate-400 space-y-2">
                            <Camera className="w-8 h-8 mx-auto text-slate-500 animate-pulse" />
                            <p className="text-[10px] max-w-[180px] leading-normal font-medium">
                              {cameraPermissionError || "Iniciando a câmera traseira do aparelho automaticamente..."}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* MANUAL FORM FALLBACK */}
                    <div className="relative flex py-2 items-center shrink-0">
                      <div className="flex-grow border-t border-slate-200"></div>
                      <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ou digite o código</span>
                      <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={12}
                        placeholder="Ex: LIVE-ON95"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#0066ff] bg-slate-50 font-mono tracking-wider uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => handleScanOrSubmitCode(manualCode)}
                        disabled={isLoading || !manualCode.trim()}
                        className="bg-[#0066ff] hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 text-white font-extrabold text-xs px-4 rounded-xl transition-all cursor-pointer shadow-sm border border-blue-600"
                      >
                        Enviar
                      </button>
                    </div>

                    {/* SCAN STATUS NOTIFICATIONS */}
                    {scanStatus.type !== 'idle' && (
                      <div className={`p-3 rounded-xl text-[11px] leading-tight font-bold border ${
                        scanStatus.type === 'error' 
                          ? 'bg-red-50 border-red-200 text-red-700' 
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      }`}>
                        {scanStatus.message}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* FULLSCREEN QR MODAL EXPANSIONS */}
      {expandedQr && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#0c1a30] to-[#050b14] p-6 rounded-3xl border border-white/10 max-w-md w-full flex flex-col items-center space-y-6 text-center text-white shadow-2xl relative">
            <button
              onClick={() => setExpandedQr(null)}
              className="absolute top-4 right-4 p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-400/30 text-blue-400 text-[10px] font-black rounded-md uppercase tracking-wider">
                {expandedQr === 'enrollment' ? 'Passo 1: Cadastro de Alunos' : 'Passo 2: Validação Rotativa'}
              </span>
              <h3 className="text-sm font-black mt-1 text-slate-100">
                {expandedQr === 'enrollment' ? 'Escaneie para Acessar a Sala' : 'Código de Validação Atual'}
              </h3>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-2xl border border-white/10 w-full max-w-[280px] aspect-square flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                  expandedQr === 'enrollment' ? getStudentShareUrl() : activeToken
                )}`}
                alt="QR Code Ampliado"
                className="w-full h-full object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            {expandedQr === 'token' ? (
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="bg-emerald-500/10 text-emerald-400 px-8 py-3.5 rounded-2xl font-mono text-2xl font-black tracking-widest shadow-lg leading-none border border-emerald-400/30">
                  {activeToken}
                </div>
                
                {/* Timer inside modal */}
                <div className="bg-white/5 border border-white/10 px-5 py-3 rounded-2xl flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-350">Código Expira em:</span>
                  <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-xl font-mono text-base font-black">
                    {Math.ceil(timeLeftMs / 1000)}s
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 px-6 py-2.5 rounded-2xl text-[11px] font-semibold text-slate-300 max-w-sm sm:max-w-md truncate">
                Link Manual: <span className="text-blue-450 font-mono select-all ml-1 underline">{getStudentShareUrl()}</span>
              </div>
            )}

            {/* Footer close helper */}
            <div className="pt-2 w-full">
              <button
                onClick={() => setExpandedQr(null)}
                className="w-full sm:w-auto px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all duration-250 cursor-pointer border border-white/10 shadow-md"
              >
                Fechar Ampliação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
