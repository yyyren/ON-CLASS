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
  // Detecta se é um aluno real pelo parâmetro de URL
  const isLockedStudent = (() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('mode') === 'apresentacao_aluno';
    } catch {
      return false;
    }
  })();

  // Define a role inicial com base na trava de segurança do aluno
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
      if (urlRoom) return urlRoom.toUpperCase();
      return 'ROOM95';
    } catch {
      return 'ROOM95';
    }
  });

  // Estado do Token unificado via LocalStorage estável
  const [activeToken, setActiveToken] = useState<string>(() => {
    return localStorage.getItem('onclass_pres_active_token') || 'LIVE-ON95';
  });

  const [timeLeftMs, setTimeLeftMs] = useState<number>(10000);
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

  // Estados do formulário do Aluno
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
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const getStudentShareUrl = () => {
    const origin = window.location.origin + window.location.pathname;
    return `${origin}?mode=apresentacao_aluno&room=${roomCode}`;
  };

  // Câmera Scanner nativa para o Aluno
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
            if (!decodedText.includes("mode=")) {
              handleScanOrSubmitCode(decodedText);
            }
          },
          () => {}
        ).then(() => {
          isStarted = true;
          setIsCameraActive(true);
        }).catch(() => {
          setIsCameraActive(false);
        });
      } catch (e) {
        console.error(e);
      }
    }, 500);

    return () => {
      clearTimeout(startTimeout);
      if (html5QrCode && isStarted) {
        html5QrCode.stop().then(() => setIsCameraActive(false)).catch(err => console.warn(err));
      }
    };
  }, [role, currentStudent, hasAlreadyCheckedIn, scanStatus.type]);

  // Sincronização e Polling em tempo real
  useEffect(() => {
    const syncState = () => {
      try {
        const savedAtts = localStorage.getItem('onclass_pres_attendances');
        const localAtts = savedAtts ? JSON.parse(savedAtts) : [];
        if (localAtts.length > attendances.length && role === 'presenter') {
          setActiveNotification(`🎉 ${localAtts[0].studentName} confirmou presença!`);
          setTimeout(() => setActiveNotification(null), 3500);
        }
        setAttendances(localAtts);

        const savedToken = localStorage.getItem('onclass_pres_active_token');
        if (savedToken) {
          setActiveToken(savedToken);
        }
      } catch (e) {
        console.warn(e);
      }
    };

    syncState();
    const interval = setInterval(syncState, 1000);
    return () => clearInterval(interval);
  }, [attendances.length, role]);

  // Temporizador Unificado e Rotatividade estável controlada pelo Projetor
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
            localStorage.setItem('onclass_pres_previous_token', localStorage.getItem('onclass_pres_active_token') || 'LIVE-ON95');
            localStorage.setItem('onclass_pres_active_token', code);
            setActiveToken(code);
          }
          return 10000;
        }
        return prev - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [role]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getStudentShareUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleEnrollStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentCourse.trim()) return;

    const mockStudent: PresentationStudent = {
      id: 'std-' + Math.random().toString(36).substring(2, 7),
      name: studentName,
      course: studentCourse,
      semester: studentSemester,
      enrolledAt: new Date().toISOString()
    };

    setCurrentStudent(mockStudent);
    localStorage.setItem('onclass_pres_active_student', JSON.stringify(mockStudent));
    setScanStatus({ type: 'idle', message: '' });
  };

  const handleScanOrSubmitCode = (codeToSubmit: string) => {
    if (!currentStudent || hasAlreadyCheckedIn) return;

    const cleanCode = codeToSubmit.trim().toUpperCase().replace("LIVE-", "");
    if (!cleanCode) return;

    setIsLoading(true);

    const currentTokenStored = (localStorage.getItem('onclass_pres_active_token') || activeToken).replace("LIVE-", "");
    const previousTokenStored = (localStorage.getItem('onclass_pres_previous_token') || '').replace("LIVE-", "");

    // Aceita o token atual, o recém expirado (delay de segurança) ou o padrão mestre
    const isValid = cleanCode === currentTokenStored || cleanCode === previousTokenStored || cleanCode === "ON95";

    if (!isValid) {
      setScanStatus({ 
        type: 'error', 
        message: 'Código inválido ou expirado! Aguarde o novo código atualizar na tela do professor.' 
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

    try {
      const savedAtts = localStorage.getItem('onclass_pres_attendances');
      const listAtts = savedAtts ? JSON.parse(savedAtts) : [];
      if (!listAtts.some((a: any) => a.studentId === currentStudent.id)) {
        listAtts.unshift(newAttendance);
        localStorage.setItem('onclass_pres_attendances', JSON.stringify(listAtts));
      }
      setAttendances(listAtts);
      setScanStatus({ type: 'success', message: 'Presença computada com sucesso no projetor!' });
      setManualCode('');
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetData = () => {
    if (!window.confirm("Deseja limpar os registros atuais da chamada?")) return;
    localStorage.setItem('onclass_pres_active_token', 'LIVE-ON95');
    localStorage.setItem('onclass_pres_attendances', JSON.stringify([]));
    setAttendances([]);
    setActiveToken('LIVE-ON95');
  };

  const handleAddDemoStudent = () => {
    const names = ["Rodrigo Mendes", "Amanda Lima", "Carlos Pinho", "Juliana Moraes", "Bruno Santos"];
    const courses = ["Engenharia de Software", "Análise de Sistemas", "Ciência da Computação"];
    const name = names[Math.floor(Math.random() * names.length)] + " " + Math.floor(Math.random() * 80 + 10);
    const course = courses[Math.floor(Math.random() * courses.length)];

    const newAtt: PresentationAttendance = {
      id: 'att-' + Math.random().toString(36).substring(2, 5),
      studentId: 'demo-' + Math.random().toString(36).substring(2, 5),
      studentName: name,
      course: course,
      semester: '1º Semestre',
      scannedAt: new Date().toISOString(),
      tokenUsed: activeToken
    };

    const saved = localStorage.getItem('onclass_pres_attendances');
    const list = saved ? JSON.parse(saved) : [];
    list.unshift(newAtt);
    localStorage.setItem('onclass_pres_attendances', JSON.stringify(list));
    setAttendances(list);
  };

  const handleDownloadCSV = () => {
    if (attendances.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,Nome Aluno,Curso,Semestre,Horario,Token Validador\n";
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
    <div className="w-full min-h-screen bg-[#f3f7fd] flex flex-col font-sans select-none">
      {/* HEADER DINÂMICO E PROTEGIDO CONTRA ALUNOS */}
      <header className="bg-white border-b border-blue-100 py-3.5 px-6 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <h1 className="text-sm font-extrabold text-[#0b1c30]">OnClass Presença</h1>
              <p className="text-[10px] text-slate-500 font-medium">Controle e Validação Dinâmica de Aula</p>
            </div>
          </div>

          {/* TRAVA DE SEGURANÇA MESTRE: Só exibe o alternador se não for um link de aluno trancado */}
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

          {isLockedStudent && (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-xl border border-emerald-200 font-bold text-[10px] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Portal do Estudante
            </div>
          )}
        </div>
      </header>

      {activeNotification && role === 'presenter' && (
        <div className="fixed top-20 right-6 z-50 bg-[#091e3a] text-white p-4 rounded-2xl shadow-2xl border border-blue-500/30 animate-bounce">
          <p className="text-xs font-bold">{activeNotification}</p>
        </div>
      )}

      {/* RENDER PROJETOR (PROFESSOR) */}
      {role === 'presenter' && (
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="col-span-1 lg:col-span-2 space-y-6">
            
            {/* PASSO 1 - QR CADASTRO */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-3">
              <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Passo 1: Entrar na Chamada</span>
              <p className="text-[11px] text-slate-500">Abra a câmera do celular para preencher seus dados de aluno</p>
              <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-sm">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getStudentShareUrl())}`} className="w-36 h-36" alt="QR 1" referrerPolicy="no-referrer" />
              </div>
              <div className="w-full flex gap-1 bg-[#f1f5f9] p-1.5 rounded-lg items-center">
                <span className="text-[9px] text-slate-500 font-mono truncate flex-1 text-left select-all pl-1">{getStudentShareUrl()}</span>
                <button onClick={handleCopyLink} className="bg-[#0066ff] text-white text-[9px] font-bold px-2 py-1 rounded cursor-pointer shrink-0">{copiedLink ? 'Copiado' : 'Copiar'}</button>
              </div>
            </div>

            {/* PASSO 2 - QR CODE ROTATIVO DE VALIDAÇÃO */}
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col items-center text-center space-y-3 text-white">
              <span className="bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Passo 2: Validar Presença</span>
              <p className="text-[11px] text-slate-400">Escaneie o código dinâmico gerado em tempo real abaixo</p>
              
              {/* Moldura branca de alto contraste garantida para leitura perfeita */}
              <div className="bg-white p-3.5 rounded-2xl border border-white/10 shadow-lg block">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(activeToken.replace("LIVE-", ""))}`} 
                  className="w-36 h-36 block object-contain mx-auto" 
                  alt="QR Código Validador" 
                  referrerPolicy="no-referrer" 
                />
              </div>

              <div className="flex flex-col items-center gap-1 w-full">
                <div className="bg-emerald-500/10 text-emerald-400 px-5 py-2 rounded-xl font-mono text-xl font-black tracking-widest border border-emerald-500/30">
                  {activeToken}
                </div>
                <div className="text-[10px] text-slate-400">
                  Próximo código em: <span className="font-mono text-emerald-400 font-bold">{Math.ceil(timeLeftMs / 1000)}s</span>
                </div>
              </div>
            </div>

          </div>

          {/* LISTA DE ALUNOS LOGADOS */}
          <div className="col-span-1 lg:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[540px]">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0066ff]" />
                  <h3 className="text-xs font-black text-slate-800 uppercase">Fila de Presença Confirmada</h3>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={handleAddDemoStudent} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-indigo-200 cursor-pointer">+ Simular Aluno</button>
                  <button onClick={handleDownloadCSV} disabled={attendances.length === 0} className="bg-[#0066ff] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer disabled:bg-slate-150 disabled:text-slate-400">Exportar CSV</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {attendances.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center text-xs">
                    <TableProperties className="w-6 h-6 mb-1 text-slate-300" />
                    Aguardando validação dos estudantes...
                  </div>
                ) : (
                  attendances.map((item) => (
                    <div key={item.id} className="p-2.5 bg-white border border-slate-100 rounded-xl flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="font-bold text-slate-800">{item.studentName}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{item.course} • {item.semester}</p>
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
                <span>Total de Alunos Computados: {attendances.length}</span>
                <button onClick={handleResetData} className="text-red-600 font-medium cursor-pointer hover:underline">Limpar Filtros</button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* RENDER CELULAR (ALUNO) */}
      {role === 'student' && (
        <main className="flex-1 max-w-md mx-auto w-full p-4 flex flex-col justify-center">
          {!currentStudent ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl space-y-4">
              <div className="text-center">
                <h2 className="text-base font-black text-slate-800">Check-in Estudante</h2>
                <p className="text-xs text-slate-500">Identifique-se para liberar o validador de frequência</p>
              </div>
              <form onSubmit={handleEnrollStudent} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Nome Completo</label>
                  <input type="text" required placeholder="Digite seu nome para o diário" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-slate-50/50" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Curso Atual</label>
                  <input type="text" required placeholder="Ex: Análise e Desenv. de Sistemas" value={studentCourse} onChange={(e) => setStudentCourse(e.target.value)} className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-slate-50/50" />
                </div>
                <button type="submit" className="w-full mt-2 bg-[#0066ff] hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer shadow-md transition-all">Avançar para Scanner</button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xl space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl text-xs border border-slate-100">
                <span className="font-bold text-slate-700 truncate max-w-[200px]">📍 {currentStudent.name}</span>
                <button onClick={() => { setCurrentStudent(null); localStorage.removeItem('onclass_pres_active_student'); }} className="text-red-500 text-[10px] font-bold underline">Alterar Cadastro</button>
              </div>

              {hasAlreadyCheckedIn || scanStatus.type === 'success' ? (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2 text-emerald-800 animate-fade-in">
                  <CheckCircle className="w-6 h-6 mx-auto text-emerald-600" />
                  <p className="text-xs font-bold">Presença Registrada!</p>
                  <p className="text-[10px] text-emerald-600">Seu nome já foi computado na grade de presença do professor.</p>
                </div>
              ) : (
                <>
                  <div className="relative aspect-square w-full max-w-[240px] mx-auto bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
                    <div id="qr-reader-container" className="absolute inset-0 w-full h-full object-cover"></div>
                    {!isCameraActive && (
                      <div className="text-slate-400 text-center p-4 z-10 text-[10px]">
                        <Camera className="w-6 h-6 mx-auto mb-1 animate-pulse text-slate-500" />
                        Escaneie o QR Code 2 de 10s exibido na tela ou digite abaixo.
                      </div>
                    )}
                  </div>

                  <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ou digite o código de 4 letras</div>
                  <div className="flex gap-2">
                    <input type="text" maxLength={9} placeholder="Ex: AB12" value={manualCode} onChange={(e) => setManualCode(e.target.value)} className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 font-mono tracking-widest text-center uppercase focus:border-blue-500 outline-none bg-slate-50" />
                    <button onClick={() => handleScanOrSubmitCode(manualCode)} disabled={isLoading || !manualCode.trim()} className="bg-[#0066ff] hover:bg-blue-700 text-white font-bold text-xs px-4 rounded-xl cursor-pointer disabled:bg-slate-200">Validar</button>
                  </div>

                  {scanStatus.type !== 'idle' && (
                    <div className={`p-2.5 rounded-xl text-[11px] font-bold border transition-all ${scanStatus.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
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
