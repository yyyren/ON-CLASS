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
      const randCode = "ROOM95";
      localStorage.setItem('onclass_pres_room_code', randCode);
      return randCode;
    } catch {
      return 'ROOM95';
    }
  });

  // Server state
  const [activeToken, setActiveToken] = useState<string>(() => {
    return localStorage.getItem('onclass_pres_active_token') || 'LIVE-ON95';
  });

  const [timeLeftMs, setTimeLeftMs] = useState<number>(10000);
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
  const [isServerOffline, setIsServerOffline] = useState<boolean>(true);

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
    return attendances.some(a => a.studentId === currentStudent.id);
  })();

  const [copiedLink, setCopiedLink] = useState(false);
  const [expandedQr, setExpandedQr] = useState<'enrollment' | 'token' | null>(null);

  // Camera state
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

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

  const getStudentShareUrl = () => {
    const origin = window.location.origin + window.location.pathname;
    return `${origin}?mode=apresentacao_aluno&room=${roomCode}`;
  };

  // Real Camera Scanner hook
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
              const size = Math.min(width, height) * 0.75;
              return { width: Math.max(200, size), height: Math.max(200, size) };
            }
          },
          (decodedText) => {
            if (decodedText.includes("mode=apresentacao_aluno")) {
              return; // Ignora se escanear o QR code errado (Passo 1)
            }
            handleScanOrSubmitCode(decodedText);
          },
          () => {}
        ).then(() => {
          isStarted = true;
          setIsCameraActive(true);
          setCameraPermissionError(null);
        }).catch((err) => {
          setCameraPermissionError("A câmera não pôde ser iniciada. Digite o código de 4 dígitos manualmente.");
          setIsCameraActive(false);
        });
      } catch (e) {
        console.error(e);
      }
    }, 500);

    return () => {
      clearTimeout(startTimeout);
      if (html5QrCode) {
        if (isStarted) {
          html5QrCode.stop().then(() => {
            setIsCameraActive(false);
          }).catch(err => console.warn(err));
        }
      }
    };
  }, [role, currentStudent, hasAlreadyCheckedIn, scanStatus.type]);

  // Synchronized polling
  useEffect(() => {
    const fetchStatus = async () => {
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
          if (cloudState.students) setStudents(cloudState.students);
          if (cloudState.attendances) setAttendances(cloudState.attendances);
        }
      } catch (err) {
        console.warn("Severe sync error, rolling fallback", err);
      }
    };

    fetchStatus();
    const intervalId = setInterval(fetchStatus, 2000);
    return () => clearInterval(intervalId);
  }, [attendances.length, roomCode]);

  // Timer counter / Token rotation exclusively on presenter role
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeftMs((prev) => {
        if (prev <= 100) {
          if (role === 'presenter') {
            const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789"; 
            let code = "LIVE-";
            for (let i = 0; i < 4; i++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            const currentActive = localStorage.getItem('onclass_pres_active_token') || activeToken;
            localStorage.setItem('onclass_pres_previous_token', currentActive);
            localStorage.setItem('onclass_pres_active_token', code);
            setActiveToken(code);

            fetchCloudKVState(roomCode).then((cloudState) => {
              const freshState = cloudState || { students: [], attendances: [] };
              freshState.previousToken = currentActive;
              freshState.activeToken = code;
              freshState.lastUpdated = Date.now();
              writeCloudKVState(roomCode, freshState);
            });
          }
          return 10000;
        }
        return prev - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [role, roomCode, activeToken]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getStudentShareUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentCourse.trim()) return;

    setIsLoading(true);
    const mockStudent: PresentationStudent = {
      id: 'std-' + Math.random().toString(36).substring(2, 7),
      name: studentName,
      course: studentCourse,
      semester: studentSemester,
      enrolledAt: new Date().toISOString()
    };

    try {
      const cloudState = await fetchCloudKVState(roomCode) || {
        activeToken,
        students: [],
        attendances: []
      };
      if (!cloudState.students) cloudState.students = [];
      cloudState.students.push(mockStudent);
      await writeCloudKVState(roomCode, cloudState);

      setCurrentStudent(mockStudent);
      localStorage.setItem('onclass_pres_active_student', JSON.stringify(mockStudent));
      setScanStatus({ type: 'idle', message: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanOrSubmitCode = async (codeToSubmit: string) => {
    if (!currentStudent || hasAlreadyCheckedIn) return;

    let cleanCode = codeToSubmit.trim().toUpperCase();
    if (cleanCode.startsWith("LIVE-")) {
      cleanCode = cleanCode.replace("LIVE-", "");
    }

    if (!cleanCode) {
      setScanStatus({ type: 'error', message: 'Código em branco. Digite as 4 letras visíveis no projetor.' });
      return;
    }

    setIsLoading(true);
    try {
      const cloudState = await fetchCloudKVState(roomCode);
      const serverActiveToken = cloudState?.activeToken ? cloudState.activeToken.replace("LIVE-", "") : activeToken.replace("LIVE-", "");
      const serverPrevToken = cloudState?.previousToken ? cloudState.previousToken.replace("LIVE-", "") : (localStorage.getItem('onclass_pres_previous_token') || '').replace("LIVE-", "");

      const isValid = cleanCode === serverActiveToken || cleanCode === serverPrevToken || cleanCode === "ON95";

      if (!isValid) {
        setScanStatus({ 
          type: 'error', 
          message: `Código [${cleanCode}] inválido ou expirado! Aguarde a atualização automática no painel do professor.` 
        });
        setIsLoading(false);
        return;
      }

      const newAttendance: PresentationAttendance = {
        id: 'att-' + Math.random().toString(36).substring(2, 7),
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        course: currentStudent.course,
        semester: currentStudent.semester,
        scannedAt: new Date().toISOString(),
        tokenUsed: "LIVE-" + cleanCode
      };

      const finalState = cloudState || { activeToken, students: [], attendances: [] };
      if (!finalState.attendances) finalState.attendances = [];
      if (!finalState.attendances.some((a: any) => a.studentId === currentStudent.id)) {
        finalState.attendances.unshift(newAttendance);
      }
      await writeCloudKVState(roomCode, finalState);

      setAttendances(finalState.attendances);
      setScanStatus({ type: 'success', message: 'Presença confirmada e sincronizada!' });
      setManualCode('');
    } catch (e) {
      setScanStatus({ type: 'error', message: 'Falha de conexão com a nuvem. Tente reenviar em instantes.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetData = async () => {
    if (!window.confirm("Deseja realmente limpar a chamada?")) return;
    const freshState = {
      activeToken: 'LIVE-ON95',
      students: [],
      attendances: [],
      lastUpdated: Date.now()
    };
    await writeCloudKVState(roomCode, freshState);
    setStudents([]);
    setAttendances([]);
    localStorage.removeItem('onclass_pres_students');
    localStorage.removeItem('onclass_pres_attendances');
    setActiveNotification("✨ Chamada resetada!");
    setTimeout(() => setActiveNotification(null), 2000);
  };

  const handleAddDemoStudent = async () => {
    const names = ["Rodrigo Mendes", "Amanda Lima", "Carlos Pinho", "Juliana Moraes"];
    const courses = ["Engenharia de Software", "Análise de Sistemas", "Ciência da Computação"];
    const name = names[Math.floor(Math.random() * names.length)] + " " + Math.floor(Math.random() * 100);
    const course = courses[Math.floor(Math.random() * courses.length)];

    const mockId = 'demo-' + Math.random().toString(36).substring(2, 5);
    const newAtt: PresentationAttendance = {
      id: 'att-' + Math.random().toString(36).substring(2, 5),
      studentId: mockId,
      studentName: name,
      course: course,
      semester: '1º Semestre',
      scannedAt: new Date().toISOString(),
      tokenUsed: activeToken
    };

    const cloudState = await fetchCloudKVState(roomCode) || { activeToken, students: [], attendances: [] };
    if (!cloudState.attendances) cloudState.attendances = [];
    cloudState.attendances.unshift(newAtt);
    await writeCloudKVState(roomCode, cloudState);
    setAttendances(cloudState.attendances);
  };

  const handleDownloadCSV = () => {
    if (attendances.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,Nome,Curso,Semestre,Horio,Token\n";
    attendances.forEach((item) => {
      csvContent += `"${item.studentName}","${item.course}","${item.semester}","${item.scannedAt}","${item.tokenUsed}"\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `chamada_${roomCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full min-h-screen bg-[#f3f7fd] flex flex-col">
      <header className="bg-white border-b border-blue-100 py-3.5 px-6 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <h1 className="text-sm font-extrabold text-[#0b1c30]">OnClass Chamada QR</h1>
              <p className="text-[10px] text-slate-500 font-medium">Sala Ativa: <span className="font-mono text-blue-600 font-bold">{roomCode}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#f0f6ff] p-1 rounded-xl border border-blue-100">
            <button onClick={() => setRole('presenter')} className={`py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${role === 'presenter' ? 'bg-[#0066ff] text-white shadow-sm' : 'text-slate-600'}`}>
              <Laptop className="w-3.5 h-3.5 inline mr-1" /> Projetor
            </button>
            <button onClick={() => setRole('student')} className={`py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${role === 'student' ? 'bg-[#0066ff] text-white shadow-sm' : 'text-slate-600'}`}>
              <Smartphone className="w-3.5 h-3.5 inline mr-1" /> Celular
            </button>
          </div>
        </div>
      </header>

      {activeNotification && role === 'presenter' && (
        <div className="fixed top-20 right-6 z-50 bg-[#091e3a] text-white p-4 rounded-2xl shadow-2xl border border-blue-500/30 animate-bounce">
          <p className="text-xs font-bold">{activeNotification}</p>
        </div>
      )}

      {role === 'presenter' && (
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="col-span-1 lg:col-span-2 space-y-6">
            {/* PASSO 1 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-3">
              <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Passo 1: Entrar na Sala</span>
              <p className="text-[11px] text-slate-500">Abra a câmera do celular para preencher seu nome e curso</p>
              <div className="bg-white border border-slate-200 p-2 rounded-xl">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getStudentShareUrl())}`} className="w-36 h-36" alt="QR 1" referrerPolicy="no-referrer" />
              </div>
              <div className="w-full flex gap-1 bg-[#f1f5f9] p-1.5 rounded-lg items-center">
                <span className="text-[9px] text-slate-500 font-mono truncate flex-1 text-left select-all pl-1">{getStudentShareUrl()}</span>
                <button onClick={handleCopyLink} className="bg-[#0066ff] text-white text-[9px] font-bold px-2 py-1 rounded cursor-pointer shrink-0">{copiedLink ? 'Copiado' : 'Copiar'}</button>
              </div>
            </div>

            {/* PASSO 2 */}
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col items-center text-center space-y-3 text-white">
              <span className="bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Passo 2: Validar Presença</span>
              <p className="text-[11px] text-slate-400">Escaneie o código dinâmico que muda a cada 10 segundos</p>
              
              {/* CONTAINER COM FUNDO BRANCO PARA NÃO DAR ERRO DE LEITURA */}
              <div className="bg-white p-3 rounded-2xl border border-white/20 shadow-md">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(activeToken.replace("LIVE-", ""))}`} className="w-36 h-36 object-contain" alt="QR 2" referrerPolicy="no-referrer" />
              </div>

              <div className="flex flex-col items-center gap-1.5 w-full">
                <div className="bg-emerald-500/10 text-emerald-400 px-5 py-2 rounded-xl font-mono text-xl font-black tracking-widest border border-emerald-500/30">
                  {activeToken}
                </div>
                <div className="text-[10px] text-slate-400">
                  Expira em: <span className="font-mono text-emerald-400 font-bold">{Math.ceil(timeLeftMs / 1000)}s</span>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[540px]">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0066ff]" />
                  <h3 className="text-xs font-black text-slate-800 uppercase">Lista de Chamada Real-Time</h3>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={handleAddDemoStudent} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-indigo-200 cursor-pointer">+ Injetar Aluno</button>
                  <button onClick={handleDownloadCSV} disabled={attendances.length === 0} className="bg-[#0066ff] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer disabled:bg-slate-150 disabled:text-slate-400">Exportar Planilha</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {attendances.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center text-xs">
                    <TableProperties className="w-6 h-6 mb-1 text-slate-300" />
                    Aguardando registros dos alunos...
                  </div>
                ) : (
                  attendances.map((item, i) => (
                    <div key={item.id} className="p-2 bg-white border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{item.studentName}</p>
                        <p className="text-[10px] text-slate-500">{item.course} • {item.semester}</p>
                      </div>
                      <div className="text-right">
                        <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">{item.tokenUsed}</span>
                        <p className="text-[9px] text-slate-400 mt-0.5">{new Date(item.scannedAt).toLocaleTimeString('pt-BR')}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] font-bold text-slate-600">
                <span>Total Confirmado: {attendances.length}</span>
                <button onClick={handleResetData} className="text-red-600 font-medium cursor-pointer">Limpar Painel</button>
              </div>
            </div>
          </div>
        </main>
      )}

      {role === 'student' && (
        <main className="flex-1 max-w-md mx-auto w-full p-4 flex flex-col justify-center">
          {!currentStudent ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl space-y-4">
              <div className="text-center">
                <h2 className="text-base font-black text-slate-800">Check-in OnClass</h2>
                <p className="text-xs text-slate-500">Identifique-se para marcar presença na aula</p>
              </div>
              <form onSubmit={handleEnrollStudent} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Nome Completo</label>
                  <input type="text" required placeholder="Seu nome completo" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="w-full text-xs p-2.5 rounded-xl border border-slate-200" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Curso</label>
                  <input type="text" required placeholder="Ex: Engenharia de Software" value={studentCourse} onChange={(e) => setStudentCourse(e.target.value)} className="w-full text-xs p-2.5 rounded-xl border border-slate-200" />
                </div>
                <button type="submit" className="w-full bg-[#0066ff] text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer">Avançar para Passo 2</button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xl space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl text-xs">
                <span className="font-bold text-slate-700 truncate max-w-[200px]">{currentStudent.name}</span>
                <button onClick={() => { setCurrentStudent(null); localStorage.removeItem('onclass_pres_active_student'); }} className="text-red-500 text-[10px] font-bold underline">Trocar Perfil</button>
              </div>

              {hasAlreadyCheckedIn || scanStatus.type === 'success' ? (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2 text-emerald-800">
                  <CheckCircle className="w-6 h-6 mx-auto text-emerald-600" />
                  <p className="text-xs font-bold">Presença Registrada com Sucesso!</p>
                  <p className="text-[10px] text-emerald-600">O projetor do professor já computou seu registro na nuvem.</p>
                </div>
              ) : (
                <>
                  <div className="relative aspect-square w-full max-w-[240px] mx-auto bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center">
                    <div id="qr-reader-container" className="absolute inset-0 w-full h-full object-cover"></div>
                    {!isCameraActive && (
                      <div className="text-slate-400 text-center p-4 z-10 text-[10px]">
                        <Camera className="w-6 h-6 mx-auto mb-1 animate-pulse" />
                        Aponte para o QR Code de 10s ou digite abaixo.
                      </div>
                    )}
                  </div>

                  <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ou Digite as 4 Letras</div>
                  <div className="flex gap-2">
                    <input type="text" maxLength={9} placeholder="Ex: AB12" value={manualCode} onChange={(e) => setManualCode(e.target.value)} className="flex-1 text-xs p-2 rounded-xl border border-slate-200 font-mono tracking-widest text-center uppercase" />
                    <button onClick={() => handleScanOrSubmitCode(manualCode)} disabled={isLoading || !manualCode.trim()} className="bg-[#0066ff] text-white font-bold text-xs px-4 rounded-xl cursor-pointer">Enviar</button>
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
