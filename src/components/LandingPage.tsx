import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Mail, Lock, User as UserIcon, Shield, ArrowRight, Eye, EyeOff, BookOpen, Database, Wifi, WifiOff, Activity, Check, Copy } from 'lucide-react';
import { INITIAL_TEACHER, INITIAL_STUDENT } from '../data/mockData';
import { isSupabaseConfigured, isSupabaseEnvPresent, dbSignIn, dbSignUp, testSupabaseConnection, saveCustomSupabaseConfig, clearCustomSupabaseConfig, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { SUPABASE_SQL_SCHEMA } from '../lib/supabaseHelper';

interface LandingPageProps {
  onLogin: (user: User) => void;
  onRegister: (user: User) => void;
  onActivatePresentation?: () => void;
}

type OnboardingState = 'welcome' | 'login' | 'register';

export default function LandingPage({ onLogin, onRegister, onActivatePresentation }: LandingPageProps) {
  const [screenState, setScreenState] = useState<OnboardingState>('welcome');
  const [activeRole, setActiveRole] = useState<UserRole>('aluno');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  // Form Fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerId, setRegisterId] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [agreement, setAgreement] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Supabase quick-test local panel states
  const [showDbPanel, setShowDbPanel] = useState(true); // Open by default so the user notices it easily!
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // States for custom Supabase credentials directly inputted in the web UI
  const [customUrlInput, setCustomUrlInput] = useState(supabaseUrl || '');
  const [customKeyInput, setCustomKeyInput] = useState(supabaseAnonKey || '');
  const [credentialFormOpen, setCredentialFormOpen] = useState(false);
  const [customConfigError, setCustomConfigError] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const handleSaveCustomCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomConfigError('');
    setSaveSuccessMsg('');
    if (!customUrlInput.trim() || !customKeyInput.trim()) {
      setCustomConfigError('Por favor, preencha os dois campos (URL e Anon Key)!');
      return;
    }
    if (!customUrlInput.trim().startsWith('https://')) {
      setCustomConfigError('A URL do Supabase deve começar com https://');
      return;
    }
    saveCustomSupabaseConfig(customUrlInput, customKeyInput);
    setSaveSuccessMsg('Salvo no navegador! Recarregando página para conectar ao seu banco...');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleClearCustomCredentials = () => {
    clearCustomSupabaseConfig();
    setCustomUrlInput('');
    setCustomKeyInput('');
    setCustomConfigError('');
    setSaveSuccessMsg('Configurações redefinidas para o padrão! Recarregando página...');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  // States for shared mobile access
  const publicSharedUrl = "https://ais-pre-2d5v5o7nbnet7oosxfk4m3-788359251676.us-east1.run.app";
  const [selectedMobileUrlType, setSelectedMobileUrlType] = useState<'public' | 'local'>('public');
  const [simulatedAccounts, setSimulatedAccounts] = useState<{ user: User; passwordHash: string }[]>(() => {
    try {
      const saved = localStorage.getItem('onclass_simulated_accounts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [currentUrl, setCurrentUrl] = useState(() => {
    try {
      return window.location.href;
    } catch (e) {
      return '';
    }
  });
  const [copiedLink, setCopiedLink] = useState(false);

  const getActiveMobileUrl = () => {
    return selectedMobileUrlType === 'public' ? publicSharedUrl : (currentUrl || publicSharedUrl);
  };

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(getActiveMobileUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.warn("Navegador não suporta clipboard API automático");
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testSupabaseConnection();
      setTestResult({
        success: result.success,
        message: result.message
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Falha geral ao conectar: ${err.message || err}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!loginEmail) {
      setErrorMsg('Por favor, preencha o e-mail ou matrícula.');
      return;
    }
    if (!loginPassword || loginPassword.length < 4) {
      setErrorMsg('A senha deve conter no mínimo 4 caracteres.');
      return;
    }

    // Connect using appropriate registered accounts cache (offline mode / local fallback) FIRST
    const normalizedInput = loginEmail.trim().toLowerCase();
    const matchedAccount = simulatedAccounts.find(
      acc => acc.user.email.trim().toLowerCase() === normalizedInput || 
             (acc.user.registrationId && acc.user.registrationId.trim().toLowerCase() === normalizedInput)
    );

    // If there is an exact matching local simulated account, we can log in with it instantly (great bypass if Supabase is offline!)
    if (matchedAccount && matchedAccount.passwordHash.trim() === loginPassword.trim()) {
      // Auto toggle to correct tab if role mismatch
      if (matchedAccount.user.role !== activeRole) {
        setActiveRole(matchedAccount.user.role);
      }
      onLogin(matchedAccount.user);
      return;
    }

    if (isSupabaseConfigured) {
      if (!loginEmail.includes('@')) {
        setErrorMsg('Com o Supabase Ativo, você precisa digitar seu e-mail institucional completo.');
        return;
      }
      if (loginPassword.length < 6) {
        setErrorMsg('⚠️ No Supabase, a senha de login por padrão deve conter no mínimo 6 caracteres.');
        return;
      }
      setIsSubmitLoading(true);
      try {
        const loggedInUser = await dbSignIn(loginEmail, loginPassword);
        
        // Save matching state in local simulated accounts also, to keep offline access active
        const exists = simulatedAccounts.some(acc => acc.user.email.toLowerCase() === loggedInUser.email.toLowerCase());
        if (!exists) {
          const updated = [...simulatedAccounts, { user: loggedInUser, passwordHash: loginPassword }];
          setSimulatedAccounts(updated);
          localStorage.setItem('onclass_simulated_accounts', JSON.stringify(updated));
        }
        
        onLogin(loggedInUser);
        return;
      } catch (err: any) {
        setIsSubmitLoading(false);
        const rawMsg = err.message || String(err);
        let solvedMsg = `Erro no Supabase: ${rawMsg}`;
        if (rawMsg.includes('confirm') || rawMsg.includes('Confirm') || rawMsg.includes('verified')) {
          solvedMsg = '⚠️ E-mail não verificado! No seu painel Supabase, vá em "Authentication" -> "Providers" -> "Email" e desmarque/desative a opção "Confirm email" para permitir login instantâneo de contas de teste.';
        } else if (rawMsg.includes('invalid') || rawMsg.includes('Invalid') || rawMsg.includes('credentials')) {
          solvedMsg = '⚠️ Credenciais inválidas. Verifique seu e-mail/senha e se selecionou a aba correta (Aluno ou Professor) acima.';
        } else if (rawMsg.includes('connection') || rawMsg.includes('timeout') || rawMsg.includes('network')) {
          solvedMsg = '⚠️ Erro de rede ou indisponibilidade no Supabase. Para prosseguir na apresentação, use o simulador do Modo Offline criando uma conta local na aba de cadastro.';
        }
        setErrorMsg(solvedMsg);
        return;
      }
    }

    if (matchedAccount) {
      if (matchedAccount.passwordHash.trim() !== loginPassword.trim()) {
        setErrorMsg('Senha incorreta para esta conta simulada local (Modo Offline).');
        return;
      }
      // Auto toggle to correct tab if role mismatch
      if (matchedAccount.user.role !== activeRole) {
        setActiveRole(matchedAccount.user.role);
      }
      onLogin(matchedAccount.user);
      return;
    }

    // Connect automatically using appropriate mocked profiles (offline fallback)
    if (activeRole === 'professor') {
      const teacher: User = {
        ...INITIAL_TEACHER,
        email: loginEmail.includes('@') ? loginEmail : INITIAL_TEACHER.email,
        name: loginEmail.split('@')[0] !== loginEmail ? loginEmail.split('@')[0].replace('.', ' ') : INITIAL_TEACHER.name
      };
      onLogin(teacher);
    } else {
      const student: User = {
        ...INITIAL_STUDENT,
        email: loginEmail.includes('@') ? loginEmail : INITIAL_STUDENT.email,
        registrationId: loginEmail.includes('@') ? INITIAL_STUDENT.registrationId : loginEmail
      };
      onLogin(student);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!registerName || !registerId || !registerEmail || !registerPassword) {
      setErrorMsg('Por favor, preencha todos os campos.');
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }
    if (!agreement) {
      setErrorMsg('Você precisa aceitar os Termos de Serviço para criar uma conta.');
      return;
    }

    if (isSupabaseConfigured) {
      if (!registerEmail.includes('@')) {
        setErrorMsg('Insira um e-mail institucional válido para cadastrar no Supabase.');
        return;
      }
      if (registerPassword.length < 6) {
        setErrorMsg('⚠️ No Supabase, a senha deve conter no mínimo 6 caracteres.');
        return;
      }
      setIsSubmitLoading(true);
      try {
        const newUser = await dbSignUp(registerEmail, registerPassword, activeRole, registerName, registerId);
        
        // Replicate user registration state locally in simulated accounts cache so photo updates can be saved and retrieved offline
        const updatedAccounts = [...simulatedAccounts, { user: newUser, passwordHash: registerPassword }];
        setSimulatedAccounts(updatedAccounts);
        try {
          localStorage.setItem('onclass_simulated_accounts', JSON.stringify(updatedAccounts));
        } catch (e) {
          console.warn("Storage write failed", e);
        }

        onRegister(newUser);
        return;
      } catch (err: any) {
        setIsSubmitLoading(false);
        const rawMsg = err.message || String(err);
        let solvedMsg = `Erro ao registrar no Supabase: ${rawMsg}`;
        if (rawMsg.includes('confirm') || rawMsg.includes('Confirm')) {
          solvedMsg = '⚠️ Conta cadastrada com sucesso! No entanto, o seu Supabase está configurado para exigir confirmação de e-mail. Para desativar essa exigência de testes, vá para o seu painel do Supabase em Authentication -> Providers -> Email e desative a chave "Confirm email".';
        } else if (rawMsg.includes('length') || rawMsg.includes('least 6') || rawMsg.includes('weak') || rawMsg.includes('Weak') || rawMsg.includes('should be')) {
          solvedMsg = '⚠️ A senha deve conter no mínimo 6 caracteres por padrão nas configurações de segurança do Supabase.';
        } else if (rawMsg.includes('already registered') || rawMsg.includes('already exists') || rawMsg.includes('user_already_exists') || rawMsg.includes('registered')) {
          solvedMsg = '⚠️ Este e-mail institucional já possui uma conta no Supabase. Tente entrar diretamente.';
        }
        setErrorMsg(solvedMsg);
        return;
      }
    }

    // Success simulation (offline mode)
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: registerName,
      email: registerEmail,
      role: activeRole,
      registrationId: registerId,
      title: activeRole === 'professor' ? 'Professor(a) Coordenador(a)' : undefined,
      course: activeRole === 'aluno' ? 'Engenharia de Software' : undefined,
      semester: activeRole === 'aluno' ? '1º Semestre' : undefined,
      shift: activeRole === 'aluno' ? 'Matutino' : undefined,
      bio: activeRole === 'professor' ? 'Novo integrante docente do OnClass Test.' : undefined
    };

    // Save in local storage simulating database
    const updatedAccounts = [...simulatedAccounts, { user: newUser, passwordHash: registerPassword }];
    setSimulatedAccounts(updatedAccounts);
    try {
      localStorage.setItem('onclass_simulated_accounts', JSON.stringify(updatedAccounts));
    } catch (e) {
      console.warn("Storage write failed", e);
    }

    onRegister(newUser);
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex flex-col justify-between items-center relative overflow-hidden font-sans p-6 z-10 select-none">
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[radial-gradient(#0066ff_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)]"></div>

      {/* Spacer top */}
      <div className="h-6"></div>

      {/* Grid container with phone-portal on left and developer/mobile access-portal on right side-by-side */}
      <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 relative z-10 my-auto">
        
        {/* Main card stage */}
        <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,102,255,0.06)] border border-[#eff4ff] p-8 relative transition-all duration-300">
          
          {/* LOGO */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-[#0066ff] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#0066ff]/20 mb-3">
              <BookOpen className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0b1c30]">OnClass</h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0066ff] mt-0.5">Ambiente Acadêmico</p>
          </div>

          {/* ---------------- 1. WELCOME SCREEN ---------------- */}
          {screenState === 'welcome' && (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="space-y-2 mb-2 text-center">
                <h2 className="text-xl font-bold text-[#0b1c30]">Presença acadêmica simplificada</h2>
                <p className="text-sm text-[#64748b]">A plataforma definitiva para automatizar chamadas, gerenciar turmas e acompanhar frequências em tempo real.</p>
              </div>

              <div className="space-y-3 pt-4">
                <button
                  id="btn-login-trigger"
                  onClick={() => setScreenState('login')}
                  className="w-full h-11 bg-[#0066ff] hover:bg-[#0054d6] text-white font-semibold rounded-xl shadow-lg shadow-[#0066ff]/15 transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  Entrar
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>

                <button
                  id="btn-register-trigger"
                  onClick={() => setScreenState('register')}
                  className="w-full h-11 bg-white hover:bg-[#f8f9ff] text-[#0066ff] border border-[#dce9ff] font-semibold rounded-xl transition-all flex items-center justify-center cursor-pointer"
                >
                  Criar Conta
                </button>

                {onActivatePresentation && (
                  <button
                    onClick={onActivatePresentation}
                    className="w-full h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10.5px] font-bold rounded-xl border border-slate-200/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    📺 Modo Apresentação (Telão)
                  </button>
                )}
              </div>

              <div className="pt-6 border-t border-[#f1f5f9]">
                <a href="#" className="text-xs font-medium text-[#64748b] hover:text-[#0066ff] flex items-center justify-center gap-1">
                  <span>Precisa de ajuda com o acesso?</span>
                </a>
              </div>
            </div>
          )}

          {/* ---------------- 2. LOGIN SCREEN ---------------- */}
          {screenState === 'login' && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-[#0b1c30]">Bem-vindo de volta</h2>
                <p className="text-sm text-[#64748b]">Acesse sua conta para continuar</p>
              </div>

              {/* ERROR FLAG */}
              {errorMsg && (
                <div className="p-4 bg-[#ffdad6] text-[#93000a] text-xs font-semibold rounded-2xl border border-[#ffb4ab] space-y-2">
                  <p>{errorMsg}</p>
                  {(errorMsg.toLowerCase().includes('supabase') || errorMsg.toLowerCase().includes('erro') || errorMsg.toLowerCase().includes('senha')) && (
                    <div className="pt-2 border-t border-[#ffb4ab]/60 space-y-1.5 text-left">
                      <p className="text-[10px] text-slate-700 font-bold leading-normal">
                        Está com problemas para conectar ao banco do Supabase ou deseja usar o sistema com dados locais simulados?
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem('onclass_disable_supabase', 'true');
                          window.location.reload();
                        }}
                        className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-[#0066ff] border border-slate-200 rounded-xl text-[10px] font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        🔌 Desativar Supabase e Entrar em Modo Simulado (Offline)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* CLOUD VS LOCAL SIMULATOR TOGGLE */}
              {isSupabaseEnvPresent && (
                <div className="p-3 rounded-2xl border flex items-center justify-between text-xs font-bold bg-[#f0f6ff] border-blue-100/50">
                  <div className="flex items-center gap-1.5 text-[#0b1c30]">
                    <span className={`w-2.5 h-2.5 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    <span>
                      {isSupabaseConfigured 
                        ? 'Supabase Conectado (Nuvem)' 
                        : 'Simulador 100% Local Ativo'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSupabaseConfigured) {
                        localStorage.setItem('onclass_disable_supabase', 'true');
                      } else {
                        localStorage.removeItem('onclass_disable_supabase');
                      }
                      window.location.reload();
                    }}
                    className="text-[10px] bg-white text-[#0066ff] px-2.5 py-1 rounded-lg border border-[#dde9ff] hover:border-[#0066ff]/20 hover:shadow-xs transition-all cursor-pointer font-black"
                  >
                    {isSupabaseConfigured ? 'Desativar Nuvem' : 'Ativar Nuvem'}
                  </button>
                </div>
              )}

              {/* TAB SELECTOR: ALUNO OR PROFESSOR */}
              <div className="grid grid-cols-2 bg-[#f0f6ff] p-1 rounded-xl border border-[#dce9ff] mb-4">
                <button
                  type="button"
                  id="tab-aluno-login"
                  onClick={() => { setActiveRole('aluno'); setErrorMsg(''); }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeRole === 'aluno'
                      ? 'bg-white text-[#0066ff] shadow-sm'
                      : 'text-[#64748b] hover:text-[#0b1c30]'
                  }`}
                >
                  Aluno
                </button>
                <button
                  type="button"
                  id="tab-teacher-login"
                  onClick={() => { setActiveRole('professor'); setErrorMsg(''); }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeRole === 'professor'
                      ? 'bg-white text-[#0066ff] shadow-sm'
                      : 'text-[#64748b] hover:text-[#0b1c30]'
                  }`}
                >
                  Professor
                </button>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Email / RA */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#0b1c30]" htmlFor="login-email">
                    {activeRole === 'aluno' ? 'E-mail ou Matrícula/RA' : 'E-mail Institucional'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748b]">
                      <Mail className="w-4.5 h-4.5" />
                    </div>
                    <input
                      id="login-email"
                      type={activeRole === 'aluno' ? 'text' : 'email'}
                      placeholder={activeRole === 'aluno' ? 'Ex: 2023091A ou e-mail' : 'Ex: nome@universidade.edu.br'}
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 bg-white border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-sm transition-all outline-none focus:ring-3 focus:ring-[#0066ff]/10"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-[#0b1c30]" htmlFor="login-pass">
                      Senha
                    </label>
                    <a href="#" className="text-xs font-semibold text-[#0066ff] hover:underline">
                      Esqueci minha senha
                    </a>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748b]">
                      <Lock className="w-4.5 h-4.5" />
                    </div>
                    <input
                      id="login-pass"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Sua senha de acesso"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full h-11 pl-10 pr-10 bg-white border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-sm transition-all outline-none focus:ring-3 focus:ring-[#0066ff]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#64748b] hover:text-[#0b1c30] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  id="btn-login"
                  disabled={isSubmitLoading}
                  className={`w-full h-11 text-white font-semibold rounded-xl shadow-lg transition-all text-sm mt-2 flex items-center justify-center gap-2 cursor-pointer ${
                    isSubmitLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#0066ff] hover:bg-[#0054d6] shadow-[#0066ff]/15'
                  }`}
                >
                  {isSubmitLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </button>
              </form>

              {/* SHORTCUTS OR DEMO QUICK LOGINS */}
              {simulatedAccounts.length > 0 ? (
                <div className="mt-2 p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-2 text-left animate-fade-in">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold text-[#10b981] flex items-center gap-1">
                      <span>💾</span> Suas Contas Criadas (Neste Navegador):
                    </p>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (confirm("Deseja mesmo limpar as contas salvas localmente neste navegador?")) {
                          setSimulatedAccounts([]);
                          localStorage.removeItem('onclass_simulated_accounts');
                        }
                      }} 
                      className="text-[9px] text-red-500 hover:underline font-bold cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {simulatedAccounts.map((acc, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setLoginEmail(acc.user.email);
                          setLoginPassword(acc.passwordHash);
                          setActiveRole(acc.user.role);
                          // Delay login slightly so form fills visually
                          setTimeout(() => {
                            onLogin(acc.user);
                          }, 150);
                        }}
                        className="w-full p-2 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left flex items-center justify-between text-xs transition-all cursor-pointer group"
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold text-slate-800 text-[11px] truncate">{acc.user.name}</p>
                          <p className="text-[9px] text-slate-500 truncate font-medium">
                            {acc.user.email} {acc.user.registrationId ? `• RA: ${acc.user.registrationId}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                            acc.user.role === 'professor' 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {acc.user.role === 'professor' ? 'Prof' : 'Aluno'}
                          </span>
                          <span className="text-[9px] text-[#0066ff] font-extrabold transition-transform group-hover:translate-x-0.5 inline-block">
                            Entrar →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-2 p-3 bg-amber-50/70 border border-amber-100 rounded-xl space-y-1.5 text-left animate-fade-in">
                  <p className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                    <span>⚡</span> Entrar com Contas Prontas de Teste:
                  </p>
                  <p className="text-[9px] text-slate-600 leading-relaxed">
                    Nenhuma conta personalizada salva encontrada. Use contas padrões com 1 clique para testar rápido:
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const testStudent: User = {
                          ...INITIAL_STUDENT,
                          email: 'aluno.teste@onclass.edu.br',
                          name: 'Pedro Aluno de Teste 🎓',
                          registrationId: '202611A2'
                        };
                        const updated = [...simulatedAccounts, { user: testStudent, passwordHash: '1234' }];
                        setSimulatedAccounts(updated);
                        localStorage.setItem('onclass_simulated_accounts', JSON.stringify(updated));
                        onLogin(testStudent);
                      }}
                      className="py-1.5 px-2 bg-white hover:bg-amber-100/50 border border-amber-200 hover:border-amber-300 rounded-lg text-center text-[10px] font-extrabold text-amber-900 cursor-pointer transition-all"
                    >
                      Aluno de Teste
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const testTeacher: User = {
                          ...INITIAL_TEACHER,
                          email: 'professor.teste@onclass.edu.br',
                          name: 'Prof. Marcos da Silva 👨‍🏫'
                        };
                        const updated = [...simulatedAccounts, { user: testTeacher, passwordHash: '1234' }];
                        setSimulatedAccounts(updated);
                        localStorage.setItem('onclass_simulated_accounts', JSON.stringify(updated));
                        onLogin(testTeacher);
                      }}
                      className="py-1.5 px-2 bg-white hover:bg-amber-100/50 border border-amber-200 hover:border-amber-300 rounded-lg text-center text-[10px] font-extrabold text-amber-900 cursor-pointer transition-all"
                    >
                      Professor de Teste
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-[#f1f5f9] flex justify-between items-center text-xs text-[#64748b]">
                <span>Não possui login?</span>
                <button
                  onClick={() => { setScreenState('register'); setErrorMsg(''); }}
                  className="font-bold text-[#0066ff] hover:underline cursor-pointer"
                >
                  Criar nova conta
                </button>
              </div>
              
              <button
                onClick={() => setScreenState('welcome')}
                className="w-full text-center text-xs font-semibold text-[#64748b] hover:text-[#0b1c30] hover:underline cursor-pointer"
              >
                Voltar ao início
              </button>

              <div className="mt-4 p-3.5 bg-blue-50/80 border border-blue-100 rounded-2xl space-y-2.5 text-left">
                <p className="text-[10.5px] font-black text-[#0066ff] flex items-center gap-1">
                  <span>🛠️</span> Como Desativar a Confirmação de E-mail no Supabase:
                </p>
                <div className="text-[10px] text-[#2c3e50] leading-relaxed space-y-2 font-medium">
                  <p className="font-semibold text-slate-700">Para que você consiga criar contas e fazer login instantaneamente sem precisar confirmar o e-mail real, siga este passo a passo rápido no painel do Supabase:</p>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                    <li>
                      Acesse a sua conta e o projeto no <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-[#0066ff] font-extrabold hover:underline">Painel do Supabase (supabase.com)</a>.
                    </li>
                    <li>
                      No menu lateral esquerdo, clique na opção <strong className="text-slate-800">Authentication</strong> (ícone de cadeado / silhueta).
                    </li>
                    <li>
                      Clique na sub-aba <strong className="text-slate-800">Providers</strong> (perto do topo).
                    </li>
                    <li>
                      Clique para expandir a opção <strong className="text-slate-800">Email</strong>.
                    </li>
                    <li>
                      Procure pela chave <strong className="text-red-600">"Confirm email"</strong> (ou "Enable email confirmation") e <strong className="text-red-600">DESATIVE / DESMARQUE</strong> essa opção.
                    </li>
                    <li>
                      Role até o final da seção de email e clique no botão verde <strong className="text-emerald-700">Save (Salvar)</strong>.
                    </li>
                  </ol>
                  <div className="pt-2 border-t border-blue-200/50 flex flex-col gap-1 text-[9px] text-slate-500 font-bold">
                    <p>• <strong>DICA OFF_LINE:</strong> Se preferir não mexer no Supabase agora, você pode clicar no botão acima em vermelho para usar o sistema em **Modo Local Offline** com simulação!</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- 3. REGISTER SCREEN ---------------- */}
          {screenState === 'register' && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-[#0b1c30]">Crie sua conta</h2>
                <p className="text-xs text-[#64748b]">Acesso imediato ao sistema acadêmico</p>
              </div>

              {/* ERROR FLAG */}
              {errorMsg && (
                <div className="p-4 bg-[#ffdad6] text-[#93000a] text-xs font-semibold rounded-2xl border border-[#ffb4ab] space-y-2">
                  <p>{errorMsg}</p>
                  {(errorMsg.toLowerCase().includes('supabase') || errorMsg.toLowerCase().includes('erro') || errorMsg.toLowerCase().includes('cadastro')) && (
                    <div className="pt-2 border-t border-[#ffb4ab]/60 space-y-1.5 text-left">
                      <p className="text-[10px] text-slate-700 font-bold leading-normal">
                        Está com problemas para conectar ao banco do Supabase ou deseja usar o sistema com dados locais simulados?
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem('onclass_disable_supabase', 'true');
                          window.location.reload();
                        }}
                        className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-[#0066ff] border border-slate-200 rounded-xl text-[10px] font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        🔌 Desativar Supabase e Criar Conta Local (Offline)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* CLOUD VS LOCAL SIMULATOR TOGGLE */}
              {isSupabaseEnvPresent && (
                <div className="p-3 rounded-2xl border flex items-center justify-between text-xs font-bold bg-[#f0f6ff] border-blue-100/50 mb-2">
                  <div className="flex items-center gap-1.5 text-[#0b1c30]">
                    <span className={`w-2.5 h-2.5 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    <span>
                      {isSupabaseConfigured 
                        ? 'Supabase Conectado (Nuvem)' 
                        : 'Simulador 100% Local Ativo'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSupabaseConfigured) {
                        localStorage.setItem('onclass_disable_supabase', 'true');
                      } else {
                        localStorage.removeItem('onclass_disable_supabase');
                      }
                      window.location.reload();
                    }}
                    className="text-[10px] bg-white text-[#0066ff] px-2.5 py-1 rounded-lg border border-[#dde9ff] hover:border-[#0066ff]/20 hover:shadow-xs transition-all cursor-pointer font-black"
                  >
                    {isSupabaseConfigured ? 'Desativar Nuvem' : 'Ativar Nuvem'}
                  </button>
                </div>
              )}

              {/* ROLE PICKER */}
              <div className="grid grid-cols-2 bg-[#f0f6ff] p-1 rounded-xl border border-[#dce9ff] mb-2">
                <button
                  type="button"
                  onClick={() => { setActiveRole('aluno'); setErrorMsg(''); }}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeRole === 'aluno'
                      ? 'bg-white text-[#0066ff] shadow-sm'
                      : 'text-[#64748b] hover:text-[#0b1c30]'
                  }`}
                >
                  Sou Aluno
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveRole('professor'); setErrorMsg(''); }}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeRole === 'professor'
                      ? 'bg-white text-[#0066ff] shadow-sm'
                      : 'text-[#64748b] hover:text-[#0b1c30]'
                  }`}
                >
                  Sou Professor
                </button>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                {/* Full name */}
                <div className="space-y-0.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]" htmlFor="reg-name">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748b]">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      placeholder="Ex: João da Silva"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full h-10 pl-9 pr-4 bg-[#f8f9ff]/50 border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none"
                    />
                  </div>
                </div>

                {/* ID registration / RA */}
                <div className="space-y-0.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]" htmlFor="reg-id">
                    {activeRole === 'aluno' ? 'Matrícula (RA)' : 'Código de Registro Funcional'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748b]">
                      <Shield className="w-4 h-4" />
                    </div>
                    <input
                      id="reg-id"
                      type="text"
                      required
                      placeholder={activeRole === 'aluno' ? 'Ex: 2023001' : 'Ex: DOC-9981'}
                      value={registerId}
                      onChange={(e) => setRegisterId(e.target.value)}
                      className="w-full h-10 pl-9 pr-4 bg-[#f8f9ff]/50 border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-0.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]" htmlFor="reg-email">
                    E-mail Acadêmico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748b]">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      placeholder="Ex: nome@instituicao.edu.br"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full h-10 pl-9 pr-4 bg-[#f8f9ff]/50 border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Password split */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]" htmlFor="reg-pass">
                      Senha
                    </label>
                    <input
                      id="reg-pass"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="w-full h-10 px-3 bg-[#f8f9ff]/50 border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]" htmlFor="reg-confirm">
                      Confirmar Senha
                    </label>
                    <input
                      id="reg-confirm"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      className="w-full h-10 px-3 bg-[#f8f9ff]/50 border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Terms of Service Checkbox */}
                <div className="flex items-start gap-2 pt-1">
                  <input
                    id="agree-checkbox"
                    type="checkbox"
                    checked={agreement}
                    onChange={(e) => setAgreement(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-[#c2c6d8] text-[#0066ff] focus:ring-[#0066ff]/20 cursor-pointer"
                  />
                  <label htmlFor="agree-checkbox" className="text-[11px] text-[#64748b] leading-tight select-none">
                    Concordo com os <a href="#" className="font-semibold text-[#0066ff] hover:underline">Termos de Serviço</a> e <a href="#" className="font-semibold text-[#0066ff] hover:underline">Política de Privacidade</a>.
                  </label>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  id="btn-register"
                  disabled={isSubmitLoading}
                  className={`w-full h-11 text-white font-semibold rounded-xl shadow-lg transition-all text-xs mt-2 flex items-center justify-center gap-2 cursor-pointer ${
                    isSubmitLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#0066ff] hover:bg-[#0054d6]'
                  }`}
                >
                  {isSubmitLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                      Criando conta no Supabase...
                    </>
                  ) : (
                    <>
                      Criar Conta
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-3 border-t border-[#f1f5f9] flex justify-between items-center text-xs text-[#64748b]">
                <span>Já possui uma conta?</span>
                <button
                  onClick={() => { setScreenState('login'); setErrorMsg(''); }}
                  className="font-bold text-[#0066ff] hover:underline cursor-pointer"
                >
                  Fazer login
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Developer & Mobile Access panel */}
        <div className="w-full max-w-md lg:max-w-sm shrink-0 space-y-6 relative z-10 animate-fade-in">
          {/* Mobile Access Card */}
          <div className="bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,102,255,0.06)] border border-[#eff4ff] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <div>
                <h3 className="text-sm font-extrabold text-[#0b1c30]">Acesso pelo Celular</h3>
                <p className="text-[10px] text-[#64748b] font-medium">Escaneie os códigos QR em tempo real com seu smartphone</p>
              </div>
            </div>

            {/* Type Switcher */}
            <div className="grid grid-cols-2 bg-[#f0f6ff] p-1 rounded-xl border border-[#dce9ff]">
              <button
                type="button"
                onClick={() => setSelectedMobileUrlType('public')}
                className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  selectedMobileUrlType === 'public'
                    ? 'bg-[#0066ff] text-white shadow-sm'
                    : 'text-[#64748b] hover:text-[#0b1c30]'
                }`}
              >
                1. Link Público (Celular)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMobileUrlType('local')}
                className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  selectedMobileUrlType === 'local'
                    ? 'bg-[#0066ff] text-white shadow-sm'
                    : 'text-[#64748b] hover:text-[#0b1c30]'
                }`}
              >
                2. Link Local (Dev / PC)
              </button>
            </div>

            {/* Warn user about Action Required screen if local link selected */}
            {selectedMobileUrlType === 'local' && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-900 rounded-lg text-[9px] leading-relaxed">
                ⚠️ <strong>Aviso de Permissão:</strong> Este link local exige login com a conta desenvolvedora do Google. Se o celular exibir "Action Required", use o <strong>Link Público</strong> acima!
              </div>
            )}

            {selectedMobileUrlType === 'public' && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-lg text-[9px] leading-relaxed">
                🚀 <strong>Recomendado:</strong> Este link de compartilhamento é 100% livre e público. Abre direto no navegador do celular!
              </div>
            )}

            <div className="flex flex-col items-center justify-center bg-[#f8f9ff] p-4 rounded-xl border border-[#eff4ff]">
              {getActiveMobileUrl() ? (
                <>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getActiveMobileUrl())}`}
                    alt="QR Code de Acesso"
                    referrerPolicy="no-referrer"
                    className="w-40 h-40 border border-slate-200 p-1.5 bg-white rounded-lg select-all"
                  />
                  <p className="text-[9px] text-[#64748b] text-center font-bold tracking-tight mt-3 max-w-[220px]">
                    {selectedMobileUrlType === 'public' 
                     ? 'Aponte a câmera do celular para este QR para carregar sem restrições!' 
                     : 'Link direto do container atual de desenvolvimento.'}
                  </p>
                </>
              ) : (
                <span className="text-xs text-slate-400">Carregando gerador de código QR...</span>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex bg-[#f1f5f9] border border-slate-200 rounded-lg p-2 items-center justify-between">
                <span className="text-[10px] text-slate-600 truncate font-mono select-all max-w-[180px]">
                  {getActiveMobileUrl()}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-2.5 h-6 bg-[#0066ff] text-white text-[10px] font-bold rounded-md flex items-center gap-1 hover:bg-[#0054d6] transition-all cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedLink ? 'Copiado' : 'Copiar'}
                </button>
              </div>

              {/* Troubleshooting cookies instructions */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[9px] text-blue-900 leading-relaxed space-y-1">
                <p className="font-extrabold flex items-center gap-1">
                  <span>💡</span> Como corrigir "Action Required" na tela do seu PC:
                </p>
                <p>O Google AI Studio roda a visualização em um iframe isolado por segurança. Se carregar em branco ou pedir ação regulatória:</p>
                <ol className="list-decimal pl-3.5 space-y-0.5 pt-0.5">
                  <li>Clique no ícone de <strong>"Abrir em nova aba"</strong> ↗ (no canto superior direito do painel de visualização da IA).</li>
                  <li>Isso carregará a página limpa com suporte total para o Supabase e login instantâneo.</li>
                </ol>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[9px] text-amber-900 leading-relaxed space-y-1">
                <p className="font-extrabold flex items-center gap-1">
                  <span>⚠️</span> Dica de Sincronização Local vs. Cloud:
                </p>
                <div className="space-y-1 pl-1">
                  <p>• <strong>Em Modo Offline / Fallback</strong>: Dispositivos salvam presenças no histórico do próprio celular/navegador onde estão abertos.</p>
                  <p>• <strong>Em Modo Cloud (Supabase)</strong>: Sincronização em tempo real de verdade. Quando o professor inicia a chamada no computador, ela aparece em milissegundos para o celular do aluno fazer o check-in.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Supabase Diagnostics & SQL Script Card */}
          <div className="bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,102,255,0.06)] border border-[#eff4ff] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <h3 className="text-sm font-extrabold text-[#0b1c30]">Diagnóstico & Tabelas SQL</h3>
                  <p className="text-[10px] text-[#64748b] font-medium">Verifique a conexão e pegue os scripts das tabelas</p>
                </div>
              </div>
            </div>

            {/* Test Connection Row */}
            <div className="p-3.5 bg-slate-50/85 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Status do Banco</span>
                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${
                  isSupabaseConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isSupabaseConfigured ? 'Ativo' : 'Offline'}
                </span>
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl border text-[10px] space-y-1 ${
                  testResult.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}>
                  <p className="font-extrabold flex items-center gap-1.5">
                    {testResult.success ? '✅ Conexão Bem-Sucedida!' : '❌ Erro na Conexão'}
                  </p>
                  <p className="font-medium leading-relaxed">{testResult.message}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full py-2 bg-[#0066ff] hover:bg-[#0054d6] disabled:bg-slate-300 text-white font-extrabold rounded-lg text-[10px] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                {isTesting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                    Testando conexão real...
                  </>
                ) : (
                  'Testar Conexão com Supabase 🔌'
                )}
              </button>
            </div>

            {/* Direct Credentials Configurator */}
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2.5">
              <button
                type="button"
                onClick={() => setCredentialFormOpen(!credentialFormOpen)}
                className="w-full flex items-center justify-between text-[10px] font-black text-[#0066ff] hover:underline cursor-pointer"
              >
                <span>🔑 {credentialFormOpen ? "Ocultar Ajustar URL/API Key" : "Ajustar URL ou Chave API do Supabase"}</span>
                <span>{credentialFormOpen ? "▲" : "▼"}</span>
              </button>

              {credentialFormOpen && (
                <form onSubmit={handleSaveCustomCredentials} className="space-y-2.5 pt-1 text-left">
                  <p className="text-[9px] text-[#475569] leading-snug">
                    Se você está vendo erro de conexão ou deseja conectar o seu próprio banco de dados temporariamente pelo navegador (salvando no navegador), preencha abaixo:
                  </p>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">VITE_SUPABASE_URL</label>
                    <input
                      type="text"
                      className="w-full px-2 py-1 text-[9px] bg-white border border-slate-200 rounded-md focus:border-blue-500 outline-hidden font-mono"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      placeholder="https://xxxxx.supabase.co"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">VITE_SUPABASE_ANON_KEY</label>
                    <input
                      type="password"
                      className="w-full px-2 py-1 text-[9px] bg-white border border-slate-200 rounded-md focus:border-blue-500 outline-hidden font-mono"
                      value={customKeyInput}
                      onChange={(e) => setCustomKeyInput(e.target.value)}
                      placeholder="eyJhbG..."
                    />
                  </div>

                  {customConfigError && (
                    <p className="text-[9px] text-red-600 font-bold">{customConfigError}</p>
                  )}
                  {saveSuccessMsg && (
                    <p className="text-[9px] text-emerald-600 font-bold">{saveSuccessMsg}</p>
                  )}

                  <div className="flex gap-2 pt-1 font-bold">
                    <button
                      type="submit"
                      className="flex-1 py-1.5 bg-[#0066ff] hover:bg-[#0054d6] text-white rounded-md text-[9px] transition-all cursor-pointer text-center"
                    >
                      Salvar e Recarregar 💾
                    </button>
                    {(localStorage.getItem('onclass_custom_supabase_url') || localStorage.getItem('onclass_custom_supabase_anon_key')) && (
                      <button
                        type="button"
                        onClick={handleClearCustomCredentials}
                        className="py-1.5 px-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-[9px] transition-all cursor-pointer text-center"
                      >
                        Limpar Config Customizada 🗑️
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Expandable SQL Schema section */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowDbPanel(!showDbPanel)}
                className="w-full py-2 px-3 bg-slate-50 hover:bg-[#f0f6ff] text-slate-700 hover:text-[#0066ff] font-extrabold rounded-lg text-[10px] border border-slate-200 hover:border-[#dde9ff] transition-all flex items-center justify-between cursor-pointer"
              >
                <span>📋 Ver Script SQL para criar tabelas</span>
                <span>{showDbPanel ? 'Fechar ✕' : 'Expandir ↴'}</span>
              </button>

              {showDbPanel && (
                <div className="space-y-2 animate-fade-in pt-1">
                  <p className="text-[9px] text-[#64748b] leading-normal font-medium">
                    Copie este código e cole no painel <strong className="text-slate-700">SQL Editor</strong> do seu Supabase para criar as tabelas necessárias:
                  </p>
                  <div className="relative font-mono">
                    <pre className="max-h-48 overflow-y-auto bg-slate-900 text-slate-100 p-3 rounded-lg text-[9px] leading-relaxed pr-12 select-all">
                      {SUPABASE_SQL_SCHEMA}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
                          setCopiedSql(true);
                          setTimeout(() => setCopiedSql(false), 2000);
                        } catch (e) {}
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      {copiedSql ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Footer Branding Credit */}
      <div className="pt-6 text-center relative z-10 select-none">
        <p className="text-[10px] text-[#94a3b8] font-medium tracking-wide">
          © {new Date().getFullYear()} OnClass. Estética Premium Educacional.
        </p>
      </div>
    </div>
  );
}
