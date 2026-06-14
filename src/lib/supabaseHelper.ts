/**
 * OnClass Test - Supabase Integration Helper
 * 
 * Este arquivo serve como a especificação de banco de dados e conector para o Supabase.
 * Abaixo estão os comandos SQL necessários para criar as tabelas no painel do Supabase,
 * além de exemplos práticos de como substituir o localStorage local pelas chamadas do SDK.
 */

// 1. SQL SCHEMA PARA COPIAR E COLAR NO SQL EDITOR DO SUPABASE:
export const SUPABASE_SQL_SCHEMA = `-- BANCO DE DADOS ONCLASS TEST - SCHEMAS SQL
-- Ative UUIDs se necessário
create extension if not exists "uuid-ossp";

-- Limpar tabelas antigas anteriores se existirem para evitar conflitos (Remoção Limpa)
drop table if exists public.registro_presencas cascade;
drop table if exists public.chamadas_ativas cascade;
drop table if exists public.turmas cascade;
drop table if exists public.perfil_usuarios cascade;

-- 1. Tabela de Perfil de Usuários (Aluno ou Professor)
create table public.perfil_usuarios (
  id uuid references auth.users on delete cascade primary key,
  nome_completo text not null,
  email_institucional text not null unique,
  tipo_usuario text not null check (tipo_usuario in ('aluno', 'professor')),
  matricula_ra text not null unique,
  titulo_cargo text, -- Professor: "Professor Adjunto", etc.
  biografia text, -- Professor bio
  avatar_url text,
  curso text, -- Aluno: "Engenharia de Software"
  semestre text, -- Aluno: "6º Semestre"
  periodo_turno text, -- Aluno: "Noturno"
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS (Row Level Security)
alter table public.perfil_usuarios enable row level security;

-- Políticas para Perfil de Usuários
create policy "Qualquer pessoa logada pode visualizar perfis" on public.perfil_usuarios for select using (auth.role() = 'authenticated');
create policy "Usuários cadastram o próprio perfil" on public.perfil_usuarios for insert with check (auth.uid() = id);
create policy "Usuários atualizam apenas o próprio perfil" on public.perfil_usuarios for update using (auth.uid() = id);

-- 2. Tabela de Turmas / Disciplinas
create table public.turmas (
  id uuid default gen_random_uuid() primary key,
  criador_id uuid references public.perfil_usuarios(id) on delete cascade not null,
  nome_disciplina text not null,
  subtitulo_ementa text,
  horario_aulas text not null, -- Ex: "Seg e Qua, 08:00 - 09:40"
  ano_grau_serie text not null, -- Ex: "3º Ano do Ensino Médio"
  total_alunos integer default 0,
  status text not null default 'ativa' check (status in ('ativa', 'em_pausa')),
  icone_identificador text default 'math',
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.turmas enable row level security;

-- Políticas para Turmas
create policy "Qualquer pessoa logada pode visualizar turmas" on public.turmas for select using (auth.role() = 'authenticated');
create policy "Professores cadastram turmas" on public.turmas for insert with check (auth.role() = 'authenticated');
create policy "Criadores gerenciam suas próprias turmas" on public.turmas for all using (auth.uid() = criador_id);

-- 3. Tabela de Chamadas Ativas (Sessões de QR Code)
create table public.chamadas_ativas (
  id uuid default gen_random_uuid() primary key,
  turma_id uuid references public.turmas(id) on delete cascade not null,
  professor_id uuid references public.perfil_usuarios(id) on delete cascade not null,
  codigo_qr_atual text not null,
  duracao_segundos integer default 10,
  sala_designada text,
  encerrada boolean default false,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.chamadas_ativas enable row level security;

-- Políticas para Chamadas Ativas
create policy "Qualquer pessoa logada pode ver chamadas ativas" on public.chamadas_ativas for select using (auth.role() = 'authenticated');
create policy "Professores iniciam chamadas" on public.chamadas_ativas for insert with check (auth.role() = 'authenticated');
create policy "Criadores gerenciam suas chamadas" on public.chamadas_ativas for all using (auth.uid() = professor_id);

-- 4. Tabela de Presenças Registradas (Histórico / Feed em tempo real)
create table public.registro_presencas (
  id uuid default gen_random_uuid() primary key,
  chamada_id uuid references public.chamadas_ativas(id) on delete cascade not null,
  turma_id uuid references public.turmas(id) on delete cascade not null,
  aluno_id uuid references public.perfil_usuarios(id) on delete cascade not null,
  status text not null default 'presente' check (status in ('presente', 'ausente', 'atraso')),
  horario_registro timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Garante que o aluno não registre presença múltipla na mesma chamada
  constraint presenca_unica_por_chamada unique (chamada_id, aluno_id)
);

alter table public.registro_presencas enable row level security;

-- Políticas para Registro de Presenças
create policy "Qualquer um pode ver registros de presenças" on public.registro_presencas for select using (auth.role() = 'authenticated');
create policy "Alunos registram a própria presença" on public.registro_presencas for insert with check (auth.uid() = aluno_id);
create policy "Professores gerenciam todas as presenças" on public.registro_presencas for all using (
  auth.uid() in (
    select id from public.perfil_usuarios where tipo_usuario = 'professor'
  )
);
`;

// 2. EXEMPLO DE CLIENT SDK CONFIGURATION:
export const SUPABASE_CLIENT_EXAMPLE_CODE = `// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sua-url-supabase.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sua-chave-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
`;

// 3. SNIPPETS DE SÍNCRONICA (COMO INTEGRAR O CÓDIGO DA INTERFACE COM SUPABASE):
export const SUPABASE_SNIPPETS = {
  getProfile: `// Buscar perfil do usuário conectado no Supabase
const { data: profile, error } = await supabase
  .from('perfil_usuarios')
  .select('*')
  .eq('id', supabase.auth.user()?.id)
  .single();`,

  getTurmas: `// Buscar as turmas ativas do professor
const { data: turmas, error } = await supabase
  .from('turmas')
  .select('*')
  .eq('criador_id', user_id)
  .order('criado_em', { ascending: false });`,

  startChamada: `// Iniciar uma sessão de chamada com QR Code
const { data: novaChamada, error } = await supabase
  .from('chamadas_ativas')
  .insert([
    {
      turma_id: turma.id,
      professor_id: user.id,
      codigo_qr_atual: 'CODE-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      sala_designada: 'Sala B-12'
    }
  ])
  .select()
  .single();`,

  realtimePresenceFeed: `// Escutar canais em tempo real (Realtime) para atualizações de novos check-ins de alunos
const presenceSubscription = supabase
  .channel('registro_presencas')
  .on('postgres_changes', { 
    event: 'INSERT', 
    schema: 'public', 
    table: 'registro_presencas',
    filter: \`chamada_id=eq.\${chamadaId}\`
  }, (payload) => {
    console.log('Nova presença registrada em tempo real:', payload.new);
    // Adicionar ao feed local do professor dinamicamente!
  })
  .subscribe();`,

  recordStudentPresence: `// Aluno registra presença escaneando QR Code
const { data, error } = await supabase
  .from('registro_presencas')
  .insert([
    {
      chamada_id: chamadaId,
      turma_id: turmaId,
      aluno_id: user.id,
      status: 'presente'
    }
  ]);`
};
