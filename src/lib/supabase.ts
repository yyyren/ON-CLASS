import { createClient } from '@supabase/supabase-js';
import { User, Turma, AttendanceRecord } from '../types';

// Helper to get custom credentials from localStorage (useful for direct browser settings)
const getLocalStorageItem = (key: string): string => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key) || '';
    }
  } catch {
    // safe fallback
  }
  return '';
};

// Safe extraction supporting both Vite (import.meta.env) and Webpack/Create React App (process.env)
const urlFromMeta = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined;
const anonFromMeta = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY : undefined;

export const supabaseUrl = 
  getLocalStorageItem('onclass_custom_supabase_url') ||
  urlFromMeta ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  '';

export const supabaseAnonKey = 
  getLocalStorageItem('onclass_custom_supabase_anon_key') ||
  anonFromMeta ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  '';

const rawIsConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://sua-url-supabase.supabase.co' &&
  supabaseAnonKey !== 'sua-chave-anon-key'
);

const getBypassState = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('onclass_disable_supabase') === 'true';
    }
  } catch {
    // safe storage
  }
  return false;
};

// Verify if credentials are valid/modified and not bypassed
export const isSupabaseConfigured = rawIsConfigured && !getBypassState();
export const isSupabaseEnvPresent = rawIsConfigured;

// Instantiate or return null if not configured
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Config utilities to be called from UI
export function saveCustomSupabaseConfig(url: string, key: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('onclass_custom_supabase_url', url.trim());
      localStorage.setItem('onclass_custom_supabase_anon_key', key.trim());
      localStorage.removeItem('onclass_disable_supabase'); // Re-enable Supabase mode
    }
  } catch (e) {
    console.error('Failed to write key to localStorage:', e);
  }
}

export function clearCustomSupabaseConfig() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('onclass_custom_supabase_url');
      localStorage.removeItem('onclass_custom_supabase_anon_key');
    }
  } catch (e) {
    console.error('Failed to clear keys from localStorage:', e);
  }
}

/**
 * Validates the connection with profile check
 */
export async function testSupabaseConnection() {
  if (!supabase) {
    return { 
      success: false, 
      message: 'Supabase não está configurado. Insira as credenciais no arquivo .env (VITE_SUPABASE_URL ou REACT_APP_SUPABASE_URL).' 
    };
  }
  
  try {
    const { data, error } = await supabase.from('perfil_usuarios').select('count', { count: 'exact', head: true });
    if (error) {
      // Check if the table is missing
      const errMsg = error.message || '';
      if (errMsg.includes('relation') && errMsg.includes('does not exist')) {
        return {
          success: true,
          message: 'Conectado ao Supabase com sucesso! Atenção: as tabelas ainda não foram criadas. Clique no botão de copiar o SQL abaixo, cole no "SQL Editor" do Supabase e clique em "Run".'
        };
      }
      throw error;
    }
    return { success: true, message: 'Conexão real estabelecida com sucesso! Tabelas detectadas e prontas para uso.', count: data };
  } catch (err: any) {
    const errMsg = err.message || String(err);
    if (errMsg.includes('relation') && errMsg.includes('does not exist')) {
      return {
        success: true,
        message: 'Conectado ao Supabase com sucesso! Atenção: as tabelas ainda não foram criadas. Clique no botão de copiar o SQL abaixo, cole no "SQL Editor" do Supabase e clique em "Run".'
      };
    }
    return { success: false, message: `Erro de conexão com o Supabase: ${errMsg}` };
  }
}

/**
 * Authentication Helper: Sign Up
 */
export async function dbSignUp(
  email: string, 
  password: string, 
  role: 'aluno' | 'professor', 
  fullName: string, 
  registrationId: string, 
  additional: any = {}
): Promise<User> {
  if (!supabase) throw new Error("Supabase não está configurado. Ative no arquivo .env.");

  // Profile icon default or clean
  const cleanAvatarUrl = additional.avatarUrl || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80`;

  // Register in Supabase auth system with options metadata so it works across devices automatically
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nome_completo: fullName,
        tipo_usuario: role,
        matricula_ra: registrationId,
        titulo_cargo: additional.title || (role === 'professor' ? 'Professor Adjunto' : null),
        biografia: additional.bio || null,
        avatar_url: cleanAvatarUrl,
        curso: additional.course || null,
        semestre: additional.semester || null,
        periodo_turno: additional.shift || null,
      }
    }
  });

  if (authError) throw authError;
  const user = authData.user;
  if (!user) throw new Error("A resposta de autenticação retornou vazia.");

  // Create corresponding user profile in public.perfil_usuarios
  const profilePayload = {
    id: user.id,
    nome_completo: fullName,
    email_institucional: email,
    tipo_usuario: role,
    matricula_ra: registrationId,
    titulo_cargo: additional.title || (role === 'professor' ? 'Professor Adjunto' : null),
    biografia: additional.bio || null,
    avatar_url: cleanAvatarUrl,
    curso: additional.course || null,
    semestre: additional.semester || null,
    periodo_turno: additional.shift || null,
  };

  const { error: profileError } = await supabase
    .from('perfil_usuarios')
    .insert([profilePayload]);

  if (profileError) {
    console.error("Cadastro bem-sucedido no Auth, mas perfil_usuarios falhou:", profileError);
    // Ignore profile errors if the user hasn't copied the SQL code yet, to prevent breaking their testing
  }

  return {
    id: user.id,
    name: fullName,
    email: email,
    role,
    registrationId,
    title: profilePayload.titulo_cargo || undefined,
    bio: profilePayload.biografia || undefined,
    avatarUrl: profilePayload.avatar_url,
    course: profilePayload.curso || undefined,
    semester: profilePayload.semestre || undefined,
    shift: profilePayload.periodo_turno || undefined,
  };
}

/**
 * Authentication Helper: Sign In
 */
export async function dbSignIn(email: string, password: string): Promise<User> {
  if (!supabase) throw new Error("Supabase não está configurado. Ative no arquivo .env.");

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) throw authError;
  const user = authData.user;
  if (!user) throw new Error("Login retornado sem dados válidos do usuário.");

  // Find user profile schema
  const { data: profile, error: profileError } = await supabase
    .from('perfil_usuarios')
    .select('*')
    .eq('id', user.id)
    .single();

  const meta = user.user_metadata || {};

  if (profileError || !profile) {
    console.warn("Perfil_usuarios não encontrado. Retornando dados salvos no Auth Metadata:", profileError);
    return {
      id: user.id,
      name: meta.nome_completo || email.split('@')[0],
      email: email,
      role: (meta.tipo_usuario as any) || 'aluno',
      registrationId: meta.matricula_ra || 'CAD-' + user.id.substring(0, 5).toUpperCase(),
      title: meta.titulo_cargo || undefined,
      bio: meta.biografia || undefined,
      avatarUrl: meta.avatar_url || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80`,
      course: meta.curso || undefined,
      semester: meta.semestre || undefined,
      shift: meta.periodo_turno || undefined,
    };
  }

  return {
    id: profile.id,
    name: profile.nome_completo,
    email: profile.email_institucional,
    role: profile.tipo_usuario as any,
    registrationId: profile.matricula_ra,
    title: profile.titulo_cargo || undefined,
    bio: profile.biografia || undefined,
    avatarUrl: profile.avatar_url || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80`,
    course: profile.curso || undefined,
    semester: profile.semestre || undefined,
    shift: profile.periodo_turno || undefined,
  };
}

/**
 * Sync classes (Turmas)
 */
export async function dbGetTurmas(userId: string, role: string): Promise<Turma[]> {
  if (!supabase) return [];

  let query = supabase.from('turmas').select('*');
  
  if (role === 'professor') {
    query = query.eq('criador_id', userId);
  }

  const { data, error } = await query.order('criado_em', { ascending: false });
  if (error) {
    console.warn("Erro ao buscar turmas no Supabase:", error);
    return [];
  }

  return (data || []).map((t: any) => ({
    id: t.id,
    name: t.nome_disciplina,
    subtitle: t.subtitulo_ementa || '',
    schedule: t.horario_aulas,
    scheduleDays: t.ano_grau_serie,
    studentsCount: t.total_alunos || 0,
    status: (t.status as any) || 'ativa',
    subjectIcon: (t.icone_identificador as any) || 'math',
  }));
}

/**
 * Create a new turma (Class)
 */
export async function dbCreateTurma(turma: Omit<Turma, 'id'>, userId: string): Promise<Turma & { criador_id: string }> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const payload = {
    criador_id: userId,
    nome_disciplina: turma.name,
    subtitulo_ementa: turma.subtitle,
    horario_aulas: turma.schedule,
    ano_grau_serie: turma.scheduleDays,
    total_alunos: turma.studentsCount,
    status: turma.status,
    icone_identificador: turma.subjectIcon,
  };

  const { data, error } = await supabase
    .from('turmas')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.nome_disciplina,
    subtitle: data.subtitulo_ementa,
    schedule: data.horario_aulas,
    scheduleDays: data.ano_grau_serie,
    studentsCount: data.total_alunos,
    status: data.status as any,
    subjectIcon: data.icone_identificador as any,
    criador_id: data.criador_id,
  };
}

/**
 * Handle active attendance starts (chamadas_ativas)
 */
export async function dbStartChamada(turmaId: string, professorId: string, qeCode: string, room: string = 'Sala B-12') {
  if (!supabase) return null;

  const payload = {
    turma_id: turmaId,
    professor_id: professorId,
    codigo_qr_atual: qeCode,
    duracao_segundos: 10,
    sala_designada: room,
    encerrada: false,
  };

  const { data, error } = await supabase
    .from('chamadas_ativas')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch any currently active (live) attendance session
 */
export async function dbGetActiveChamada() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('chamadas_ativas')
    .select(`
      id,
      turma_id,
      professor_id,
      codigo_qr_atual,
      sala_designada,
      turmas (
        nome_disciplina,
        perfil_usuarios (
          nome_completo
        )
      )
    `)
    .eq('encerrada', false)
    .order('criado_em', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  const session = data[0] as any;
  return {
    id: session.id,
    turmaId: session.turma_id,
    professorId: session.professor_id,
    qrCode: session.codigo_qr_atual,
    room: session.sala_designada,
    subjectName: session.turmas?.nome_disciplina || 'Aula',
    professorName: session.turmas?.perfil_usuarios?.nome_completo || 'Professor Coordenador'
  };
}

/**
 * End roll-call (chamadas_ativas)
 */
export async function dbEncerrarChamada(chamadaId: string) {
  if (!supabase) return;
  await supabase
    .from('chamadas_ativas')
    .update({ encerrada: true })
    .eq('id', chamadaId);
}

/**
 * Record presence
 */
export async function dbRecordPresenca(chamadaId: string, turmaId: string, studentId: string, status = 'presente') {
  if (!supabase) return null;

  const payload = {
    chamada_id: chamadaId,
    turma_id: turmaId,
    aluno_id: studentId,
    status: status,
  };

  const { data, error } = await supabase
    .from('registro_presencas')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch presence history per student
 */
export async function dbGetStudentAttendanceHistory(studentId: string): Promise<AttendanceRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('registro_presencas')
    .select(`
      id,
      status,
      horario_registro,
      turmas (
        nome_disciplina,
        horario_aulas,
        perfil_usuarios (
          nome_completo
        )
      )
    `)
    .eq('aluno_id', studentId);

  if (error) {
    console.warn("Erro ao carregar histórico de presenças:", error);
    return [];
  }

  return (data || []).map((p: any) => {
    const formattedDate = new Date(p.horario_registro).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const teacherName = p.turmas?.perfil_usuarios?.nome_completo || 'Professor Coordenador';
    
    return {
      id: p.id,
      date: formattedDate,
      time: p.turmas?.horario_aulas || '19:00 - 20:40',
      subject: p.turmas?.nome_disciplina || 'Aula',
      professor: teacherName,
      status: p.status as any,
    };
  });
}

/**
 * Update user profile in public.perfil_usuarios and auth user metadata
 */
export async function dbUpdateUserProfile(user: User): Promise<void> {
  if (!supabase) return;

  const payload = {
    nome_completo: user.name,
    matricula_ra: user.registrationId,
    titulo_cargo: user.title || null,
    biografia: user.bio || null,
    avatar_url: user.avatarUrl || null,
    curso: user.course || null,
    semestre: user.semester || null,
    periodo_turno: user.shift || null,
  };

  // 1. Try to update custom public.perfil_usuarios table
  try {
    const { error } = await supabase
      .from('perfil_usuarios')
      .update(payload)
      .eq('id', user.id);
    if (error) {
      console.warn("Aviso - Erro ao atualizar tabela perfil_usuarios (mas continuaremos pelo Auth Metadata):", error.message);
    }
  } catch (err: any) {
    console.warn("Exception ao atualizar perfil_usuarios:", err.message || err);
  }

  // 2. Always sync profile state to Supabase Auth User Metadata so it remains accessible on other devices instantly
  try {
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        nome_completo: user.name,
        matricula_ra: user.registrationId,
        titulo_cargo: user.title || null,
        biografia: user.bio || null,
        avatar_url: user.avatarUrl || null,
        curso: user.course || null,
        semestre: user.semester || null,
        periodo_turno: user.shift || null,
        tipo_usuario: user.role
      }
    });
    if (authError) {
      console.warn("Aviso - Erro ao atualizar metadados de autenticação no Supabase:", authError.message);
    }
  } catch (err: any) {
    console.warn("Falha física de rede ao sincronizar metadados no Supabase Auth:", err.message || err);
  }
}


