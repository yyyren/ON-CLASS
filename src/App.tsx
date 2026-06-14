/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Turma, AttendanceRecord, TeacherTab } from './types';
import { INITIAL_TEACHER, INITIAL_STUDENT, INITIAL_TURMAS, INITIAL_STUDENT_ATTENDANCE } from './data/mockData';
import LandingPage from './components/LandingPage';
import PresentationMode from './components/PresentationMode';
import TeacherDashboard from './components/TeacherDashboard';
import TeacherChamada from './components/TeacherChamada';
import TeacherRelatorios from './components/TeacherRelatorios';
import TeacherSettings from './components/TeacherSettings';
import TeacherConteudo from './components/TeacherConteudo';
import StudentDashboard from './components/StudentDashboard';
import StudentSuccess from './components/StudentSuccess';
import SupabaseHelperView from './components/SupabaseHelperView';
import { 
  isSupabaseConfigured, 
  dbGetTurmas, 
  dbCreateTurma, 
  dbGetStudentAttendanceHistory,
  dbStartChamada,
  dbEncerrarChamada,
  dbGetActiveChamada,
  dbRecordPresenca,
  dbUpdateUserProfile
} from './lib/supabase';
import { BookOpen, GraduationCap, ChevronRight, HelpCircle, LogOut, FileText, Settings, LayoutDashboard, Database, RefreshCw } from 'lucide-react';

const memoryStorage: Record<string, string> = {};
const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Storage access denied by browser policies (sandboxed iframe). Using memory backend.");
      return memoryStorage[key] || null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage write denied by browser policies (sandboxed iframe). Saving in memory.");
      memoryStorage[key] = value;
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      delete memoryStorage[key];
    }
  }
};

export default function App() {
  const [showPresentationMode, setShowPresentationMode] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'apresentacao_aluno' || params.get('presentation') === 'true';
    } catch {
      return false;
    }
  });

  const handleLeavePresentation = () => {
    setShowPresentationMode(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      url.searchParams.delete('presentation');
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.warn("Could not modify URL parameters", e);
    }
  };

  const [user, setUser] = useState<User | null>(() => {
    const saved = safeStorage.getItem('onclass_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [turmas, setTurmas] = useState<Turma[]>(() => {
    const saved = safeStorage.getItem('onclass_turmas');
    return saved ? JSON.parse(saved) : [];
  });

  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>(() => {
    const saved = safeStorage.getItem('onclass_student_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Navigation tabs for teacher role
  const [activeTabProf, setActiveTabProf] = useState<TeacherTab>('dashboard');
  const [selectedTurma, setSelectedTurma] = useState<Turma | null>(null);
  const [activeChamadaStats, setActiveChamadaStats] = useState<{ present: number; total: number } | null>(null);
  const [activeChamadaId, setActiveChamadaId] = useState<string | null>(null);

  // Student specific scanning state
  const [studentSuccessRecord, setStudentSuccessRecord] = useState<Omit<AttendanceRecord, 'id'> | null>(null);

  // Save states back to local storage
  useEffect(() => {
    if (user) {
      safeStorage.setItem('onclass_user', JSON.stringify(user));
    } else {
      safeStorage.removeItem('onclass_user');
    }
  }, [user]);

  useEffect(() => {
    safeStorage.setItem('onclass_turmas', JSON.stringify(turmas));
  }, [turmas]);

  useEffect(() => {
    safeStorage.setItem('onclass_student_history', JSON.stringify(attendanceHistory));
  }, [attendanceHistory]);

  // Synchronize with Supabase if online/connected
  useEffect(() => {
    if (isSupabaseConfigured && user) {
      const loadSupabaseData = async () => {
        try {
          const fetchedTurmas = await dbGetTurmas(user.id, user.role);
          if (fetchedTurmas && fetchedTurmas.length > 0) {
            setTurmas(fetchedTurmas);
          }
          if (user.role === 'aluno') {
            const fetchedHistory = await dbGetStudentAttendanceHistory(user.id);
            if (fetchedHistory && fetchedHistory.length > 0) {
              setAttendanceHistory(fetchedHistory);
            }
          }
        } catch (err: any) {
          console.warn("Sem tabelas ou erro ao carregar do Supabase (operando no fallback):", err.message || err);
        }
      };
      loadSupabaseData();
    }
  }, [user]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setSelectedTurma(null);
    setStudentSuccessRecord(null);
    if (loggedInUser.role === 'professor') {
      setActiveTabProf('dashboard');
    }
  };

  const handleRegister = (registeredUser: User) => {
    setUser(registeredUser);
    setSelectedTurma(null);
    setStudentSuccessRecord(null);
    if (registeredUser.role === 'professor') {
      setActiveTabProf('dashboard');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedTurma(null);
    setStudentSuccessRecord(null);
    safeStorage.removeItem('onclass_user');
  };

  const handleCreateTurma = async (newTurma: Omit<Turma, 'id'>) => {
    if (isSupabaseConfigured && user) {
      try {
        const created = await dbCreateTurma(newTurma, user.id);
        setTurmas((prev) => [created, ...prev]);
        return;
      } catch (err: any) {
        alert("Erro ao salvar turma no Supabase. Certifique-se de que rodou o SQL no editor do Supabase! Erro: " + (err.message || err));
      }
    }
    const created: Turma = {
      ...newTurma,
      id: `turma-${Date.now()}`
    };
    setTurmas((prev) => [created, ...prev]);
  };

  const handleStartChamada = async (turma: Turma) => {
    setSelectedTurma(turma);
    setActiveTabProf('dashboard'); // keep focus on activity context

    if (isSupabaseConfigured && user) {
      try {
        const qrSalt = 'QR_KEY_' + Math.random().toString(36).substring(3, 8).toUpperCase();
        const activeSession = await dbStartChamada(turma.id, user.id, qrSalt);
        if (activeSession) {
          setActiveChamadaId(activeSession.id);
          console.log("Sessão de chamada ativa criada com sucesso no Supabase:", activeSession.id);
        }
      } catch (err: any) {
        console.warn("Sem tabela ou erro ao iniciar chamada no Supabase (em modo fallback):", err.message || err);
      }
    }
  };

  const handleEncerrarChamada = async (stats: { present: number; total: number }) => {
    if (isSupabaseConfigured && activeChamadaId) {
      try {
        await dbEncerrarChamada(activeChamadaId);
        setActiveChamadaId(null);
      } catch (err: any) {
        console.warn("Erro ao encerrar chamada no Supabase:", err.message || err);
      }
    }
    setActiveChamadaStats(stats);
    alert(`Chamada encerrada com sucesso! Total de alunos presentes: ${stats.present}/${stats.total}.`);
    setSelectedTurma(null);
  };

  const handleStudentScanSuccess = async (newRecord: Omit<AttendanceRecord, 'id'>) => {
    if (isSupabaseConfigured && user) {
      try {
        const activeCall = await dbGetActiveChamada();
        if (activeCall) {
          await dbRecordPresenca(activeCall.id, activeCall.turmaId, user.id, 'presente');
          const updatedHistory = await dbGetStudentAttendanceHistory(user.id);
          if (updatedHistory && updatedHistory.length > 0) {
            setAttendanceHistory(updatedHistory);
          }
        } else {
          // If no active teacher call is found, create a temporary active session for user's fallback classes so it writes correctly
          const existingTurmas = await dbGetTurmas(user.id, 'aluno');
          const targetTurma = existingTurmas && existingTurmas.length > 0 ? existingTurmas[0] : null;
          if (targetTurma) {
            const tempCall = await dbStartChamada(targetTurma.id, user.id, 'LOCAL_SCAN_TEMP');
            if (tempCall) {
              await dbRecordPresenca(tempCall.id, targetTurma.id, user.id, 'presente');
              const updatedHistory = await dbGetStudentAttendanceHistory(user.id);
              if (updatedHistory && updatedHistory.length > 0) {
                setAttendanceHistory(updatedHistory);
              }
            }
          }
        }
      } catch (err: any) {
        console.warn("Erro de chave ou tabela ao registrar presença no Supabase:", err.message || err);
      }
    }

    const recordWithId: AttendanceRecord = {
      ...newRecord,
      id: `att-${Date.now()}`
    };
    setAttendanceHistory((prev) => [recordWithId, ...prev]);
    setStudentSuccessRecord(newRecord);

    if (user) {
      const matchedTurma = turmas.find(t => t.name.toLowerCase() === newRecord.subject.toLowerCase());
      if (matchedTurma) {
        const liveKey = `onclass_live_checks_${matchedTurma.id}`;
        try {
          const saved = safeStorage.getItem(liveKey);
          const list = saved ? JSON.parse(saved) : [];
          if (!list.some((item: any) => item.registrationId === user.registrationId)) {
            list.unshift({
              id: `check-${Date.now()}`,
              studentId: user.id,
              studentName: user.name,
              registrationId: user.registrationId,
              timestamp: 'agora',
              avatarUrl: user.avatarUrl || ''
            });
            safeStorage.setItem(liveKey, JSON.stringify(list));
          }
        } catch (e) {
          console.warn("Could not write to student dashboard active checking", e);
        }
      }
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    
    // Proactive sync in local simulated accounts list so profile photo (base64) & details persist across sessions
    try {
      const saved = safeStorage.getItem('onclass_simulated_accounts');
      if (saved) {
        const accounts = JSON.parse(saved);
        const updatedAccounts = accounts.map((acc: any) => {
          if (acc.user.email?.toLowerCase() === updatedUser.email?.toLowerCase() || acc.user.id === updatedUser.id) {
            return { ...acc, user: updatedUser };
          }
          return acc;
        });
        safeStorage.setItem('onclass_simulated_accounts', JSON.stringify(updatedAccounts));
      }
    } catch (e) {
      console.warn("Sem acesso ao localStorage para sincronizar lista de contas locais:", e);
    }

    if (isSupabaseConfigured) {
      try {
        await dbUpdateUserProfile(updatedUser);
      } catch (err: any) {
        console.error("Erro ao sincronizar atualização de usuário no Supabase:", err);
      }
    }
  };

  if (showPresentationMode) {
    return <PresentationMode onBack={handleLeavePresentation} />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] relative font-sans flex flex-col">

      {/* RENDER CASE A: NOT LOGGED IN LISTENER */}
      {!user ? (
        <LandingPage 
          onLogin={handleLogin} 
          onRegister={handleRegister} 
          onActivatePresentation={() => setShowPresentationMode(true)} 
        />
      ) : (
        /* RENDER CASE B: DYNAMIC PANEL CONTAINER LAYOUT */
        <div className="flex-1 flex flex-col md:flex-row relative">
          
          {/* PROFILE SUB-CASE 1: PROFESSOR PORTAL WITH LEFT SIDEBAR MENU */}
          {user.role === 'professor' ? (
            <>
              {/* TEACHER SIDEBAR */}
              <aside className="w-full md:w-64 bg-white border-r border-[#eff4ff] flex flex-col justify-between shrink-0 p-5 md:h-[calc(100vh-40px)] sticky top-0 z-30 select-none">
                <div className="space-y-6">
                  {/* Brand header */}
                  <div className="flex items-center gap-3 border-b border-[#f1f5f9] pb-4">
                    <div className="w-9 h-9 bg-[#0066ff] text-white rounded-xl flex items-center justify-center shadow-md">
                      <BookOpen className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-[#0b1c30] tracking-tight">OnClass Test</h2>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#0066ff]">Ambiente Docente</span>
                    </div>
                  </div>

                  {/* List of sidebar menus */}
                  <nav className="space-y-1">
                    {/* Dashboard Button */}
                    <button
                      onClick={() => { setActiveTabProf('dashboard'); setSelectedTurma(null); }}
                      className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                        activeTabProf === 'dashboard' && !selectedTurma
                          ? 'bg-[#f0f6ff] text-[#0066ff]'
                          : 'text-[#64748b] hover:bg-[#f8f9ff] hover:text-[#0b1c30]'
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Minhas Turmas</span>
                    </button>

                    {/* Conteúdos e Slides Button */}
                    <button
                      onClick={() => { setActiveTabProf('conteudo'); setSelectedTurma(null); }}
                      className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                        activeTabProf === 'conteudo'
                          ? 'bg-[#f0f6ff] text-[#0066ff]'
                          : 'text-[#64748b] hover:bg-[#f8f9ff] hover:text-[#0b1c30]'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Conteúdos & Materiais</span>
                    </button>

                    {/* Relatórios Button */}
                    <button
                      onClick={() => { setActiveTabProf('avaliacoes'); setSelectedTurma(null); }}
                      className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                        activeTabProf === 'avaliacoes'
                          ? 'bg-[#f0f6ff] text-[#0066ff]'
                          : 'text-[#64748b] hover:bg-[#f8f9ff] hover:text-[#0b1c30]'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Relatórios</span>
                    </button>

                    {/* Configurações Button */}
                    <button
                      onClick={() => { setActiveTabProf('configuracoes'); setSelectedTurma(null); }}
                      className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                        activeTabProf === 'configuracoes'
                          ? 'bg-[#f0f6ff] text-[#0066ff]'
                          : 'text-[#64748b] hover:bg-[#f8f9ff] hover:text-[#0b1c30]'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      <span>Configurações</span>
                    </button>

                  </nav>
                </div>

                {/* Footer Profiles details + Logout */}
                <div className="pt-6 border-t border-[#f1f5f9] space-y-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'}
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover border border-[#eff4ff]"
                    />
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-[#0b1c30] truncate">{user.name}</h4>
                      <span className="text-[10px] text-[#64748b] font-medium block truncate">{user.title || 'Docente'}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full h-10 bg-slate-50 hover:bg-[#ffdad6] text-[#64748b] hover:text-[#93000a] text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-[#dde3ec] cursor-pointer hover:border-[#ffb4ab] transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair da Conta
                  </button>
                </div>
              </aside>

              {/* RENDER STAGE BODY */}
              <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
                {/* Active roll call cockpit screen block */}
                {selectedTurma ? (
                  <TeacherChamada
                    turma={selectedTurma}
                    onEncerrarChamada={handleEncerrarChamada}
                  />
                ) : (
                  <>
                    {/* Render standard static side-panels */}
                    {activeTabProf === 'dashboard' && (
                      <TeacherDashboard
                        turmas={turmas}
                        onAddTurma={handleCreateTurma}
                        onSelectTurma={(t) => { setActiveTabProf('conteudo'); }}
                        onStartChamada={handleStartChamada}
                      />
                    )}

                    {activeTabProf === 'conteudo' && <TeacherConteudo turmas={turmas} />}

                    {activeTabProf === 'avaliacoes' && <TeacherRelatorios turmas={turmas} />}

                    {activeTabProf === 'configuracoes' && (
                      <TeacherSettings user={user} onUpdateUser={handleUpdateUser} />
                    )}
                  </>
                )}
              </main>
            </>
          ) : (
            /* PROFILE SUB-CASE 2: ALUNOS (STUDENTS) CHASSIS VIEW WITH FLOATING WRAPPERS */
            <div className="flex-1 min-h-[calc(100vh-40px)] flex items-center justify-center p-4">
              {studentSuccessRecord ? (
                <StudentSuccess
                  record={studentSuccessRecord}
                  onBackToDashboard={() => setStudentSuccessRecord(null)}
                />
              ) : (
                <StudentDashboard
                  user={user}
                  onScanSuccess={handleStudentScanSuccess}
                  attendanceHistory={attendanceHistory}
                  onUpdateUser={handleUpdateUser}
                  turmas={turmas}
                  onLogout={handleLogout}
                />
              )}
            </div>
          )}

        </div>
      )}

      {/* FLOATING PRESENTATION TRIGGER - ULTRA DISCREET SECURE BADGE */}
      <button
        onClick={() => setShowPresentationMode(true)}
        className="fixed bottom-3 right-3 z-50 flex items-center justify-center w-8 h-8 rounded-full bg-[#0b1c30]/80 hover:bg-[#0b1c30] text-white/90 border border-white/10 shadow-md transition-all duration-150 cursor-pointer active:scale-90"
        title="Modo Apresentação (Telão)"
      >
        <span className="text-[11px] font-bold">📺</span>
      </button>

    </div>
  );
}

