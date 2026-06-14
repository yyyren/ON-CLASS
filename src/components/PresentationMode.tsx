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
                  <div className="flex gap-2">
                    <input type="text" placeholder="Ex: AB12" value={manualCode} onChange={(e) => setManualCode(e.target.value)} className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 font-mono tracking-widest text-center uppercase outline-none bg-slate-50" />
                    <button onClick={() => handleScanOrSubmitCode(manualCode)} disabled={isLoading || !manualCode.trim()} className="bg-[#0066ff] text-white font-bold text-xs px-4 rounded-xl cursor-pointer disabled:bg-slate-200">Validar</button>
                  </div>

                  {scanStatus.type !== 'idle' && (
                    <div className={`p-2.5 rounded-xl text-[11px] font-bold border ${scanStatus.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                      {scanStatus.message}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
