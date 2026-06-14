export type UserRole = 'aluno' | 'professor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  registrationId: string; // RA for Aluno, Institutional registration code for Professor
  title?: string; // e.g. "Professor Titular - Física"
  bio?: string;
  avatarUrl?: string;
  semester?: string; // e.g. "6º Semestre"
  course?: string; // e.g. "Engenharia de Software"
  shift?: string; // e.g. "Noturno"
}

export interface Turma {
  id: string;
  name: string;
  subtitle: string;
  schedule: string;
  scheduleDays: string;
  studentsCount: number;
  status: 'ativa' | 'em_pausa';
  subjectIcon: 'math' | 'physics' | 'chemistry' | 'history' | 'literature' | 'code';
}

export interface AttendanceRecord {
  id: string;
  date: string;
  time: string;
  subject: string;
  professor: string;
  status: 'presente' | 'ausente' | 'atraso';
}

export interface ActiveChamada {
  id: string;
  turmaId: string;
  turmaName: string;
  subtitle: string;
  timeRange: string;
  room: string;
  presentCount: number;
  absentCount: number;
  totalStudents: number;
  codeRefreshTime: number; // in seconds, e.g. 10
}

export interface StudentCheckIn {
  id: string;
  studentName: string;
  registrationId: string;
  timestamp: string; // e.g. "agora", "2m atrás"
  avatarUrl?: string;
}

export type TeacherTab = 'dashboard' | 'turmas' | 'cronograma' | 'conteudo' | 'avaliacoes' | 'configuracoes';
export type StudentTab = 'inicio' | 'aulas' | 'tarefas' | 'perfil';

export interface MaterialTurma {
  id: string;
  turmaId: string;
  title: string;
  type: 'slide' | 'atividade' | 'material';
  linkUrl?: string;
  description: string;
  points?: number;
  dueDate?: string;
  dateAdded: string;
}

