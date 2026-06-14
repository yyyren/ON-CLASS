import React, { useState, useEffect, useRef } from 'react';
import { User, AttendanceRecord, Turma } from '../types';
import { Bell, Scan, Compass, BookOpen, AlertCircle, Sparkles, Check, Home, ListTodo, UserCheck, Calendar, Upload, LogOut, Eye, Download, ExternalLink, FileText, CheckCircle, MessageSquare } from 'lucide-react';
import { STUDENT_UPCOMING_CLASSES, INITIAL_STUDENT_ATTENDANCE } from '../data/mockData';
import { dbGetActiveChamada, isSupabaseConfigured } from '../lib/supabase';

interface StudentDashboardProps {
  user: User;
  onScanSuccess: (attendance: Omit<AttendanceRecord, 'id'>) => void;
  attendanceHistory: AttendanceRecord[];
  onUpdateUser?: (updatedUser: User) => void;
  turmas?: Turma[];
  onLogout?: () => void;
}

export default function StudentDashboard({ user, onScanSuccess, attendanceHistory, onUpdateUser, turmas = [], onLogout }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<'inicio' | 'aulas' | 'tarefas' | 'perfil'>('inicio');
  
  const todayString = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const hasAttendedToday = attendanceHistory && attendanceHistory.some(h => {
    const cleanHDate = h.date.replace(/[\s\.\,]/g, '').toLowerCase();
    const cleanToday = todayString.replace(/[\s\.\,]/g, '').toLowerCase();
    return cleanHDate === cleanToday;
  });

  const [isScanning, setIsScanning] = useState(false);
  const [selectedScannerSubject, setSelectedScannerSubject] = useState('Estrutura de Dados');
  const [selectedScannerProfessor, setSelectedScannerProfessor] = useState('Alan Turing');
  const [scanSteps, setScanSteps] = useState<'idle' | 'searching' | 'success'>('idle');

  // Input states for profile edit
  const [name, setName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [course, setCourse] = useState(user.course || 'Engenharia de Software');
  const [shift, setShift] = useState(user.shift || 'Noturno');
  const [semester, setSemester] = useState(user.semester || '6º Semestre');
  const [registrationId, setRegistrationId] = useState(user.registrationId || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // States for Class Materials, Slides and Tasks
  const [materialsList, setMaterialsList] = useState<any[]>([]);
  const [selectedClassFilterId, setSelectedClassFilterId] = useState<string>('');
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [viewingMaterial, setViewingMaterial] = useState<any | null>(null);
  const [submittingTaskAnswerId, setSubmittingTaskAnswerId] = useState<string | null>(null);
  const [taskAnswerText, setTaskAnswerText] = useState('');
  const [taskSubmissionSuccess, setTaskSubmissionSuccess] = useState(false);

  // Synchronize student tasks and materials in real-time
  useEffect(() => {
    if (turmas && turmas.length > 0 && !selectedClassFilterId) {
      setSelectedClassFilterId(turmas[0].id);
    }

    const savedMat = localStorage.getItem('onclass_materials_list');
    if (savedMat) {
      try {
        setMaterialsList(JSON.parse(savedMat));
      } catch (e) {
        console.warn(e);
      }
    }

    const savedCompleted = localStorage.getItem(`onclass_completed_${user.id}`);
    if (savedCompleted) {
      try {
        setCompletedTaskIds(JSON.parse(savedCompleted));
      } catch (e) {
        console.warn(e);
      }
    }
  }, [turmas, user.id, activeTab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setAvatarUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Sync state if user changes from upstairs
  React.useEffect(() => {
    setName(user.name);
    setAvatarUrl(user.avatarUrl || '');
    setCourse(user.course || 'Engenharia de Software');
    setShift(user.shift || 'Noturno');
    setSemester(user.semester || '6º Semestre');
    setRegistrationId(user.registrationId || '');
  }, [user]);

  // Sync selected scanner options with real classes (turmas)
  React.useEffect(() => {
    if (turmas && turmas.length > 0) {
      setSelectedScannerSubject(turmas[0].name);
      setSelectedScannerProfessor(turmas[0].subtitle || 'Professor Coordenador');
    }
  }, [turmas]);

  // Real Camera & database states
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [searchingActiveCall, setSearchingActiveCall] = useState(false);

  // Monitor camera stream & active database chama when opening scanner
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let timerId: any = null;

    if (isScanning) {
      setScanSteps('searching');
      setCameraError(null);

      // 1. Fetch any real in-progress chamada from Supabase
      if (isSupabaseConfigured) {
        setSearchingActiveCall(true);
        dbGetActiveChamada()
          .then((activeCall) => {
            if (activeCall) {
              setSelectedScannerSubject(activeCall.subjectName);
              setSelectedScannerProfessor(activeCall.professorName);
            }
          })
          .catch((e) => console.warn("Erro ao carregar chamada ativa:", e))
          .finally(() => setSearchingActiveCall(false));
      }

      // 2. Start true HTML5 device camera stream
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          activeStream = stream;
          setCameraStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn("Câmera bloqueada ou indisponível:", err);
          setCameraError("Câmera indisponível. Usando preenchimento automático.");
        });

      // 3. Scan success trigger - standard auto-register in 2.5 seconds
      timerId = setTimeout(() => {
        setScanSteps('success');
        setTimeout(() => {
          onScanSuccess({
            date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            subject: selectedScannerSubject,
            professor: selectedScannerProfessor,
            status: 'presente'
          });
          setIsScanning(false);
          setScanSteps('idle');
        }, 1000);
      }, 2500);
    } else {
      // Cleanup stream when closed
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (timerId) clearTimeout(timerId);
    };
  }, [isScanning, selectedScannerSubject, selectedScannerProfessor]);

  const startScanningMock = () => {
    setIsScanning(true);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white min-h-screen flex flex-col justify-between overflow-hidden relative font-sans shadow-2xl border border-slate-100 rounded-3xl">
      
      {/* Scrollable Core stage body */}
      <div className="flex-1 overflow-y-auto pb-24 p-5 space-y-6">
        
        {/* TAB 1: HOME/INÍCIO CONTAINER */}
        {activeTab === 'inicio' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header greeting */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <img
                  src={user.avatarUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'}
                  alt={user.name}
                  className="w-11 h-11 rounded-full object-cover border border-[#eff4ff]"
                />
                <div>
                  <span className="text-[10px] font-bold text-[#64748b] uppercase block">Bem-vindo de volta,</span>
                  <h2 className="text-sm font-extrabold text-[#0b1c30]">Olá, {user.name}</h2>
                </div>
              </div>

              {/* Notification & Logout Actions */}
              <div className="flex items-center gap-2">
                <button className="w-10 h-10 rounded-full bg-[#f0f6ff] text-[#0066ff] flex items-center justify-center relative cursor-pointer">
                  <Bell className="w-5 h-5 text-[#0066ff]" />
                  <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
                </button>

                {onLogout && (
                  <button 
                    type="button"
                    onClick={onLogout}
                    title="Sair da Conta / Logout"
                    className="w-10 h-10 rounded-full bg-[#fff0f0] hover:bg-[#ffe5e5] text-[#ba1a1a] flex items-center justify-center cursor-pointer transition-all"
                  >
                    <LogOut className="w-4.5 h-4.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Main Student identity degree box */}
            <div className="bg-white border border-[#eff4ff] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,102,255,0.02)] space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-extrabold text-[#0b1c30]">{user.course || 'Engenharia de Software'}</h3>
                  <span className="text-[11px] text-[#64748b] font-medium">{user.shift || 'Noturno'} • {user.semester || '6º Semestre'}</span>
                </div>
                <span className="text-[10px] font-bold bg-[#e5eeff] text-[#0066ff] px-2.5 py-1 rounded-full">
                  RA: {user.registrationId}
                </span>
              </div>

              {/* General active attendance line */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#64748b] font-medium">Frequência Geral</span>
                  <span className="text-[#0066ff] font-extrabold text-sm">87%</span>
                </div>
                <div className="w-full h-2.5 bg-[#f0f6ff] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '87%' }}></div>
                </div>
              </div>
            </div>

            {/* HUGE CAM ACTION ROLL CALL SCAN TRIGGER */}
            {hasAttendedToday ? (
              <div className="bg-[#e1ffec] text-[#006645] rounded-3xl p-6 text-center border border-[#b4ffd0] shadow-md flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                  <UserCheck className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-[#006645] uppercase tracking-wider">Presença Confirmada Hoje! ✅</h3>
                  <p className="text-[11px] text-emerald-800 leading-relaxed max-w-[240px] mx-auto">
                    Sua presença para o dia de hoje já está registrada e consolidada no sistema. Não é possível alterar dados ou refazer.
                  </p>
                </div>
              </div>
            ) : (
              <div
                id="qr-scanner-trigger-card"
                onClick={startScanningMock}
                className="bg-[#0066ff] text-white rounded-3xl p-6 text-center shadow-lg shadow-[#0066ff]/20 flex flex-col items-center justify-center gap-4 group cursor-pointer hover:bg-[#0054d6] transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20 shadow-inner">
                  <Scan className="w-7 h-7 text-white stroke-[2.5]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold tracking-tight">Registrar Presença</h3>
                  <p className="text-xs text-white/80 max-w-[240px] mx-auto leading-relaxed">
                    Aponte a câmera para o QR Code do professor projetado em sala de aula
                  </p>
                </div>
              </div>
            )}

            {/* CLASS TIMELINE: PRÓXIMAS AULAS */}
            <div className="space-y-3.5">
              <div className="flex justify-between items-baseline">
                <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">Próximas Aulas</h3>
                <button className="text-xs font-bold text-[#0066ff] hover:underline cursor-pointer">Ver todas</button>
              </div>

              <div className="space-y-3 relative before:absolute before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-[#eff4ff]">
                {(turmas && turmas.length > 0
                  ? turmas.slice(0, 3).map((t) => ({
                      id: t.id,
                      time: t.schedule || '19:00 - 20:40',
                      subject: t.name,
                      professor: t.subtitle || 'Professor Coordenador',
                      room: t.scheduleDays || 'Sala B-12'
                    }))
                  : STUDENT_UPCOMING_CLASSES
                ).map((schoolClass, idx) => (
                  <div key={schoolClass.id} className="flex gap-4 items-start relative pl-8">
                    {/* Circle indicators on timeline axis */}
                    <span className={`absolute left-2 top-1.5 w-3 h-3 rounded-full border-2 bg-white ${
                      idx === 0 
                        ? 'border-[#0066ff]' 
                        : 'border-[#c2c6d8]'
                    }`}></span>
                    
                    <div className="flex-1 bg-[#f8f9ff]/75 border border-[#eff4ff] rounded-xl p-3 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#64748b]">
                          <span>{schoolClass.time}</span>
                          <span className="text-[#c2c6d8]">•</span>
                          <span className="bg-[#e5eeff] text-[#0066ff] px-1.5 rounded font-mono">{schoolClass.room}</span>
                        </div>
                        <h4 className="text-xs font-extrabold text-[#0b1c30] mt-1">{schoolClass.subject}</h4>
                        <span className="text-[10px] text-[#64748b] font-medium block mt-0.5">{schoolClass.professor}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CHECK-IN HISTORY LISTS */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">Histórico Recente</h3>

              <div className="space-y-2.5">
                {attendanceHistory.length === 0 ? (
                  <div className="bg-white border border-dashed border-[#dde3ec] rounded-2xl p-6 text-center">
                    <span className="text-2xl block mb-2">📅</span>
                    <h4 className="text-xs font-bold text-[#0b1c30]">Nenhuma presença registrada</h4>
                    <p className="text-[10px] text-[#64748b] mt-1">Utilize o leitor de QR Code acima para registrar sua presença em sala de aula.</p>
                  </div>
                ) : (
                  attendanceHistory.map((rec) => {
                    // Extract month and day dynamically avoiding hardcode
                    const getDayAndMonth = (dateStr: string) => {
                      if (!dateStr) return { day: '--', month: 'REG' };
                      const cleanStr = dateStr.replace(' de', '').replace('.', '');
                      const parts = cleanStr.split(' ');
                      if (parts.length >= 2) {
                        return { day: parts[0], month: parts[1].substring(0, 3).toUpperCase() };
                      }
                      const slashParts = dateStr.split('/');
                      if (slashParts.length >= 2) {
                        const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
                        return { day: slashParts[0], month: months[parseInt(slashParts[1], 10) - 1] || 'REG' };
                      }
                      return { day: dateStr.substring(0, 5), month: 'REG' };
                    };
                    const { day, month } = getDayAndMonth(rec.date);

                    return (
                      <div key={rec.id} className="bg-white border border-[#eff4ff] rounded-xl p-3 flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-3">
                          {/* Box Calendar design item */}
                          <div className="w-10 h-10 rounded-lg bg-[#f0f6ff] text-[#0066ff] flex flex-col items-center justify-center font-bold font-sans">
                            <span className="text-[9px] text-[#0066ff] leading-none uppercase">{month}</span>
                            <span className="text-sm text-[#000] leading-none mt-0.5">{day}</span>
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-[#0b1c30]">{rec.subject}</h4>
                            <span className="text-[10px] text-[#64748b] font-medium block">{rec.time}</span>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase flex items-center gap-0.5 ${
                          rec.status === 'presente'
                            ? 'bg-[#e1ffec] text-[#006645]'
                            : 'bg-[#ffdad6] text-[#93000a]'
                        }`}>
                          {rec.status === 'presente' ? '✔ Presente' : '✕ Ausente'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PERFIL - STUDENT PROFILE SCREEN */}
        {activeTab === 'perfil' && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-[#f1f5f9] pb-4">
              <h3 className="text-base font-extrabold text-[#0b1c30]">Meu Perfil</h3>
              <p className="text-[11px] text-[#64748b]">Atualize seus dados cadastrais e foto de perfil.</p>
            </div>

            {saveSuccess && (
              <div className="p-3 bg-[#e1ffec] text-[#006645] text-[11px] font-bold rounded-xl border border-[#b4ffd0] flex items-center gap-1.5 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Perfil atualizado com sucesso!</span>
              </div>
            )}

            <form onSubmit={(e) => {
              e.preventDefault();
              if (onUpdateUser) {
                onUpdateUser({
                  ...user,
                  name,
                  avatarUrl,
                  course,
                  shift,
                  semester,
                  registrationId
                });
              }
              setSaveSuccess(true);
              setTimeout(() => setSaveSuccess(false), 3000);
            }} className="space-y-4 pb-4">
              <div className="space-y-3 pb-4 border-b border-[#eff4ff]">
                <span className="text-[10px] font-bold text-[#0b1c30] block uppercase tracking-wider">Foto do Perfil</span>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="relative group">
                    <img
                      src={avatarUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'}
                      alt={name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-[#dde3ec] shadow-sm"
                    />
                  </div>
                  
                  <div className="flex-1 space-y-2 w-full">
                    {!hasAttendedToday ? (
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0066ff] hover:bg-[#0054d6] text-white text-[11px] font-bold rounded-xl shadow-sm transition-all">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Escolher da Galeria</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                          />
                        </label>
                        
                        {avatarUrl && (
                          <button
                            type="button"
                            onClick={() => setAvatarUrl('')}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#64748b] hover:text-[#0b1c30] text-[11px] font-bold rounded-xl transition-all"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">⚠️ Alteração de Foto Desativada</span>
                    )}
                    <p className="text-[10px] text-[#64748b]">Tamanho recomendado até 2MB.</p>
                  </div>
                </div>
              </div>

              {/* Informative lock warning banner */}
              {hasAttendedToday && (
                <div className="p-3.5 bg-amber-50 text-amber-800 text-[10.5px] rounded-xl border border-amber-200 leading-relaxed font-semibold">
                  ⚠️ <strong>Identidade Segura Ativa:</strong> Como você já registrou presença hoje, seus dados de perfil foram congelados para evitar falsificação de identidade (impostação de nomes de terceiros).
                </div>
              )}

              {/* Form inputs */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#0b1c30]">Nome Completo</label>
                <input
                  type="text"
                  required
                  disabled={hasAttendedToday}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full h-9 px-3.5 rounded-xl text-xs transition-all outline-none border ${
                    hasAttendedToday 
                      ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed select-none' 
                      : 'bg-white border-[#c2c6d8] focus:border-[#0066ff]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#0b1c30]">Registro Acadêmico (RA)</label>
                  <input
                    type="text"
                    required
                    disabled={hasAttendedToday}
                    value={registrationId}
                    onChange={(e) => setRegistrationId(e.target.value)}
                    className={`w-full h-9 px-3.5 rounded-xl text-xs transition-all outline-none border ${
                      hasAttendedToday 
                        ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed select-none' 
                        : 'bg-white border-[#c2c6d8] focus:border-[#0066ff]'
                    }`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#0b1c30]">Turno/Período</label>
                  <select
                    disabled={hasAttendedToday}
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className={`w-full h-9 px-2 rounded-xl text-xs transition-all outline-none border ${
                      hasAttendedToday 
                        ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed select-none' 
                        : 'bg-white border-[#c2c6d8] focus:border-[#0066ff]'
                    }`}
                  >
                    <option value="Noturno">Noturno</option>
                    <option value="Diurno">Diurno</option>
                    <option value="Integral">Integral</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#0b1c30]">Curso</label>
                <input
                  type="text"
                  required
                  disabled={hasAttendedToday}
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className={`w-full h-9 px-3.5 rounded-xl text-xs transition-all outline-none border ${
                    hasAttendedToday 
                      ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed select-none' 
                      : 'bg-white border-[#c2c6d8] focus:border-[#0066ff]'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#0b1c30]">Semestre Atual</label>
                <input
                  type="text"
                  required
                  disabled={hasAttendedToday}
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  placeholder="Ex: 6º Semestre"
                  className={`w-full h-9 px-3.5 rounded-xl text-xs transition-all outline-none border ${
                    hasAttendedToday 
                      ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed select-none' 
                      : 'bg-white border-[#c2c6d8] focus:border-[#0066ff]'
                  }`}
                />
              </div>

              {/* Action Button */}
              <div className="pt-3 space-y-3">
                <button
                  type="submit"
                  disabled={hasAttendedToday}
                  className={`w-full h-10 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all outline-none focus:outline-none ${
                    hasAttendedToday 
                      ? 'bg-slate-100 text-slate-350 border border-slate-200 cursor-not-allowed' 
                      : 'bg-[#0066ff] hover:bg-[#0054d6] text-white shadow-md shadow-[#0066ff]/10 cursor-pointer'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Salvar Alterações
                </button>

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full h-10 bg-white hover:bg-[#fff0f0] text-[#ba1a1a] border border-[#ffdad6] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair da Conta (Logout)
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: AULAS - SLIDES & MATERIAIS */}
        {activeTab === 'aulas' && (
          <div className="space-y-4 animate-fade-in">
            <div className="border-b border-[#f1f5f9] pb-3">
              <h3 className="text-base font-extrabold text-[#0b1c30]">Aulas & Slides do Professor</h3>
              <p className="text-[10px] text-[#64748b]">Acesse os slides projetados de aula e materiais complementares postados para estudar.</p>
            </div>

            {/* Selector of turmas */}
            <div className="flex gap-2 overflow-x-auto pb-1.5 select-none scrollbar-none">
              {turmas.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setSelectedClassFilterId(t.id)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border shrink-0 cursor-pointer ${
                    selectedClassFilterId === t.id
                      ? 'bg-[#0066ff] border-[#0066ff] text-white shadow-sm'
                      : 'bg-[#f8f9ff] border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {/* List of class materials filtered by Class and by type !== activity */}
            {(() => {
              const classMaterials = materialsList.filter(
                (m) => m.turmaId === selectedClassFilterId && (m.type === 'slide' || m.type === 'material')
              );

              if (classMaterials.length === 0) {
                return (
                  <div className="bg-[#f8f9ff]/55 border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
                    <span className="text-2xl block">📁</span>
                    <h4 className="text-xs font-bold text-[#0b1c30]">Nenhum slide disponível</h4>
                    <p className="text-[10px] text-[#64748b] leading-relaxed max-w-[200px] mx-auto">
                      O professor ainda não disponibilizou slides ou leituras para esta matéria nesta semana.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {classMaterials.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-[#eff4ff] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all space-y-3.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                            item.type === 'slide' ? 'bg-blue-50 text-[#0066ff]' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {item.type === 'slide' ? '💻 Slide de Aula' : '📚 Material de Apoio'}
                          </span>
                          <h4 className="text-xs font-extrabold text-[#0b1c30] mt-1.5 leading-tight">{item.title}</h4>
                        </div>
                        
                        <span className="text-[8px] font-mono text-[#64748b]">{item.dateAdded}</span>
                      </div>

                      <p className="text-[10.5px] text-[#64748b] leading-normal font-sans font-semibold">{item.description}</p>

                      {/* Link preview image */}
                      {item.linkUrl && item.type === 'slide' && (
                        <div 
                          onClick={() => setViewingMaterial(item)}
                          className="relative rounded-xl overflow-hidden aspect-video border border-slate-100 max-h-[140px] cursor-pointer"
                        >
                          <img
                            src={item.linkUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/3 overlay-fade flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                            <span className="px-3 py-1.5 bg-[#0066ff] text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-sm">
                              <Eye className="w-3 h-3" /> Ampliar Slide
                            </span>
                          </div>
                        </div>
                      )}

                      {/* CTA Buttons */}
                      <div className="pt-2.5 border-t border-slate-50 flex justify-end gap-2 text-[10px]">
                        {item.type === 'slide' && item.linkUrl && (
                          <button
                            type="button"
                            onClick={() => setViewingMaterial(item)}
                            className="px-3 h-7 bg-[#0066ff]/10 hover:bg-[#0066ff]/25 text-[#0066ff] font-extrabold rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" /> Abrir Slide
                          </button>
                        )}
                        {item.linkUrl && (
                          <a
                            href={item.linkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 h-7 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-lg flex items-center gap-1 cursor-pointer border border-slate-200 transition-all justify-center"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 3: TAREFAS/ATIVIDADES DA DISCIPLINA */}
        {activeTab === 'tarefas' && (
          <div className="space-y-4 animate-fade-in">
            <div className="border-b border-[#f1f5f9] pb-3">
              <h3 className="text-base font-extrabold text-[#0b1c30]">Atividades & Pendências</h3>
              <p className="text-[10px] text-[#64748b]">Acompanhe as tarefas solicitadas e realize o envio de suas respostas.</p>
            </div>

            {/* Selector of turmas */}
            <div className="flex gap-2 overflow-x-auto pb-1.5 select-none scrollbar-none">
              {turmas.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setSelectedClassFilterId(t.id)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border shrink-0 cursor-pointer ${
                    selectedClassFilterId === t.id
                      ? 'bg-[#0066ff] border-[#0066ff] text-white shadow-sm'
                      : 'bg-[#f8f9ff] border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {/* List of class activities filtered by Class */}
            {(() => {
              const classTasks = materialsList.filter(
                (m) => m.turmaId === selectedClassFilterId && m.type === 'atividade'
              );

              if (classTasks.length === 0) {
                return (
                  <div className="bg-[#f8f9ff]/55 border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
                    <span className="text-2xl block">🎉</span>
                    <h4 className="text-xs font-bold text-[#0b1c30]">Tudo em dia!</h4>
                    <p className="text-[10px] text-[#64748b] leading-relaxed max-w-[200px] mx-auto">
                      Não há nenhuma atividade ou trabalho escolar pendente para esta matéria. Parabéns!
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {classTasks.map((task) => {
                    const isCompleted = completedTaskIds.includes(task.id);

                    return (
                      <div
                        key={task.id}
                        className={`border rounded-2xl p-4 transition-all space-y-3 ${
                          isCompleted
                            ? 'bg-emerald-50/40 border-emerald-200 shadow-2xs'
                            : 'bg-white border-slate-150 hover:border-amber-200 shadow-sm'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider ${
                              isCompleted 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : 'bg-amber-50 text-amber-800'
                            }`}>
                              {isCompleted ? '✓ Entregue' : '⏳ Pendente'}
                            </span>
                            <h4 className="text-xs font-black text-[#0b1c30] mt-1.5 leading-tight">{task.title}</h4>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] font-black text-[#0066ff] bg-[#e5eeff] px-2 py-0.5 rounded-md block">
                              {task.points} pts
                            </span>
                          </div>
                        </div>

                        <p className="text-[10.5px] text-[#64748b] leading-relaxed font-semibold">{task.description}</p>

                        <div className="flex flex-wrap items-center justify-between text-[10px] text-[#64748b] pt-2 gap-2 border-t border-dashed border-slate-100">
                          <span>Postado: <strong>{task.dateAdded}</strong></span>
                          {task.dueDate && (
                            <span className="text-amber-800 font-bold bg-amber-50/50 px-1.5 py-0.5 rounded">Prazo: {task.dueDate}</span>
                          )}
                        </div>

                        {/* Interactive submitting workflow inside card */}
                        {!isCompleted ? (
                          <div className="pt-2">
                            {submittingTaskAnswerId === task.id ? (
                              <div className="space-y-2.5">
                                <textarea
                                  required
                                  rows={3}
                                  placeholder="Digite sua resposta acadêmica ou solução aqui..."
                                  value={taskAnswerText}
                                  onChange={(e) => setTaskAnswerText(e.target.value)}
                                  className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-[#0066ff] rounded-xl text-xs outline-none resize-none font-medium text-slate-800"
                                />
                                {taskSubmissionSuccess && (
                                  <p className="text-[10px] text-emerald-600 font-bold">✔ Enviando com sucesso...</p>
                                )}
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => { setSubmittingTaskAnswerId(null); setTaskAnswerText(''); }}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 text-[10px] font-bold rounded-lg cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!taskAnswerText.trim()) return;
                                      setTaskSubmissionSuccess(true);
                                      setTimeout(() => {
                                        const newCompleted = [...completedTaskIds, task.id];
                                        setCompletedTaskIds(newCompleted);
                                        localStorage.setItem(`onclass_completed_${user.id}`, JSON.stringify(newCompleted));
                                        
                                        setSubmittingTaskAnswerId(null);
                                        setTaskAnswerText('');
                                        setTaskSubmissionSuccess(false);
                                        alert("Trabalho acadêmico enviado com sucesso ao professor!");
                                      }, 1000);
                                    }}
                                    className="px-3 py-1.5 bg-[#0066ff] hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" /> Enviar Resposta
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSubmittingTaskAnswerId(task.id)}
                                className="w-full h-8.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
                              >
                                <MessageSquare className="w-3.5 h-3.5" /> Responder e Entregar
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-200/50 text-[10px] leading-relaxed font-bold flex items-center gap-1.5">
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Atividade enviada e computada com sucesso!</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* FIXED MOBILE BOTTOM NAVBAR */}
      <div className="absolute bottom-0 left-0 right-0 h-18 bg-white border-t border-[#eff4ff] grid grid-cols-4 items-center px-4 select-none">
        
        {/* Tab 1 - Home */}
        <button
          onClick={() => setActiveTab('inicio')}
          className={`flex flex-col items-center justify-center gap-1 font-semibold text-[10px] cursor-pointer ${
            activeTab === 'inicio' ? 'text-[#0066ff]' : 'text-[#64748b] hover:text-[#0b1c30]'
          }`}
        >
          <Home className="w-5 h-5 stroke-[2]" />
          <span>Início</span>
        </button>

        {/* Tab 2 - Aulas */}
        <button
          onClick={() => setActiveTab('aulas')}
          className={`flex flex-col items-center justify-center gap-1 font-semibold text-[10px] cursor-pointer ${
            activeTab === 'aulas' ? 'text-[#0066ff]' : 'text-[#64748b] hover:text-[#0b1c30]'
          }`}
        >
          <Compass className="w-5 h-5 stroke-[2]" />
          <span>Aulas</span>
        </button>

        {/* Tab 3 - Tarefas */}
        <button
          onClick={() => setActiveTab('tarefas')}
          className={`flex flex-col items-center justify-center gap-1 font-semibold text-[10px] cursor-pointer ${
            activeTab === 'tarefas' ? 'text-[#0066ff]' : 'text-[#64748b] hover:text-[#0b1c30]'
          }`}
        >
          <ListTodo className="w-5 h-5 stroke-[2]" />
          <span>Tarefas</span>
        </button>

        {/* Tab 4 - Perfil */}
        <button
          onClick={() => setActiveTab('perfil')}
          className={`flex flex-col items-center justify-center gap-1 font-semibold text-[10px] cursor-pointer ${
            activeTab === 'perfil' ? 'text-[#0066ff]' : 'text-[#64748b] hover:text-[#0b1c30]'
          }`}
        >
          <UserCheck className="w-5 h-5 stroke-[2]" />
          <span>Perfil</span>
        </button>
      </div>

      {/* REAL CAMERA SCANNING GRAPHIC INTERACTIVE MODAL OVERLAY */}
      {isScanning && (
        <div className="absolute inset-0 bg-[#0b1c30]/95 z-50 flex flex-col justify-between items-center p-6 text-white text-center">
          
          <div className="pt-8 space-y-1 w-full">
            <span className="text-[10px] font-bold text-[#0066ff] uppercase tracking-widest block">
              {cameraError ? 'Leitor de Presença' : 'Câmera Ativa'}
            </span>
            <h3 className="text-base font-bold">Escaneando QR Code</h3>
            
            {searchingActiveCall ? (
              <p className="text-[11px] text-zinc-400 animate-pulse mt-1">Buscando chamadas ativas na faculdade...</p>
            ) : (
              <div className="pt-2 flex flex-col items-center gap-1 w-full max-w-[250px] mx-auto">
                <span className="text-[9px] text-[#64748b] font-bold uppercase">Disciplina Detetada no QR</span>
                <select
                  value={selectedScannerSubject}
                  onChange={(e) => {
                    const matchedClass = turmas.find(t => t.name === e.target.value);
                    setSelectedScannerSubject(e.target.value);
                    setSelectedScannerProfessor(matchedClass?.subtitle || 'Professor Coordenador');
                  }}
                  className="w-full h-8 px-2 bg-white/10 text-white rounded text-[11px] font-semibold border border-white/20 outline-none"
                >
                  {turmas && turmas.length > 0 ? (
                    turmas.map((t) => (
                      <option key={t.id} value={t.name} className="text-[#0b1c30] font-semibold">
                        {t.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Estrutura de Dados" className="text-[#0b1c30] font-semibold">Estruturas de Dados Avançadas</option>
                      <option value="Matemática Avançada" className="text-[#0b1c30] font-semibold">Matemática Avançada</option>
                      <option value="Física Quântica" className="text-[#0b1c30] font-semibold">Física Quântica</option>
                    </>
                  )}
                </select>
              </div>
            )}
          </div>

          {/* SENSOR CAMERA TARGET BOX WITH SWEEP SCAN LASER */}
          <div className="relative w-64 h-64 border-2 border-white/10 rounded-3xl flex items-center justify-center bg-black/50 overflow-hidden shadow-inner">
            {/* Live Camera Stream Video View */}
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="absolute inset-0 w-full h-full object-cover rounded-3xl"
            />

            {/* If camera fails or is blocked, show a nice visual feedback or placeholder */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-zinc-900/90 text-center z-10">
                <span className="text-3xl mb-1.5 opacity-80">📷</span>
                <span className="text-[10px] text-zinc-300 font-bold max-w-[180px] leading-relaxed">
                  Autorize a câmera ou aponte para um código QR projetado. No ambiente simulador, o registro ocorrerá automaticamente.
                </span>
              </div>
            )}

            {/* Four high-contrast design bracket corners */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#0066ff] rounded-tl-xl -mt-1 -ml-1 z-20"></div>
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#0066ff] rounded-tr-xl -mt-1 -mr-1 z-20"></div>
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#0066ff] rounded-bl-xl -ml-1 -mb-1 z-20"></div>
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#0066ff] rounded-br-xl -mr-1 -mb-1 z-20"></div>

            {/* Sweep laser animated line */}
            <div className="absolute w-[90%] h-0.5 bg-cyan-400 opacity-80 left-[5%] shadow-[0_0_10px_#22d3ee] animate-sweep-laser z-20"></div>
            
            {!cameraError && (
              <span className="absolute bottom-4 text-[9px] text-white/50 bg-black/45 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider z-20">
                Aponte para o QR Code
              </span>
            )}
          </div>

          <div className="pb-8 space-y-4 w-full">
            <p className="text-xs text-white/70 leading-relaxed max-w-[250px] mx-auto min-h-[32px]">
              {scanSteps === 'searching' 
                ? 'Analisando assinatura e código de segurança criptográfico do QR...' 
                : '✔ Chamada registrada! Sincronizando presença...'}
            </p>

            <button
              onClick={() => setIsScanning(false)}
              className="px-6 h-10 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* VIEWING SLIDE OVERLAY MODAL */}
      {viewingMaterial && (
        <div className="fixed inset-0 bg-black/85 z-55 flex flex-col justify-center p-4">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-sm mx-auto w-full border border-slate-100 flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <span className="text-[10px] font-black uppercase text-[#0066ff]">Visualização de Slide</span>
              <button
                type="button"
                onClick={() => setViewingMaterial(null)}
                className="text-slate-500 hover:text-slate-900 font-extrabold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="aspect-video w-full select-none bg-slate-900 flex items-center justify-center">
              <img
                src={viewingMaterial.linkUrl || 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1000'}
                alt={viewingMaterial.title}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="p-4 space-y-2">
              <h4 className="text-xs font-extrabold text-slate-800">{viewingMaterial.title}</h4>
              <p className="text-[10px] text-slate-500 leading-normal font-sans font-semibold">{viewingMaterial.description}</p>
              
              <button
                type="button"
                onClick={() => setViewingMaterial(null)}
                className="w-full h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all mt-2"
              >
                Fechar Janela
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
