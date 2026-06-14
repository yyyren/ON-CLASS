import { User, Turma, AttendanceRecord, StudentCheckIn, ActiveChamada } from '../types';

export const INITIAL_TEACHER: User = {
  id: 'teacher-123',
  name: 'Dr. Carlos Mendes',
  email: 'carlos.mendes@universidade.edu.br',
  role: 'professor',
  registrationId: 'DOC-55823',
  title: 'Professor Titular - Física',
  bio: 'Doutor em Física Quântica com 15 anos de experiência acadêmica. Pesquisador ativo e apaixonado por inovação no ensino de ciências exatas.',
  avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
};

export const INITIAL_STUDENT: User = {
  id: 'student-999',
  name: 'Lucas Ferreira',
  email: 'lucas.ferreira@aluno.universidade.edu.br',
  role: 'aluno',
  registrationId: '2023091A',
  course: 'Engenharia de Software',
  shift: 'Noturno',
  semester: '6º Semestre',
  avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
};

export const INITIAL_TURMAS: Turma[] = [
  {
    id: 'turma-1',
    name: 'Matemática Avançada',
    subtitle: 'Álgebra Linear e Geometria',
    schedule: 'Seg e Qua, 08:00 - 09:40',
    scheduleDays: '3º ANO DO ENSINO MÉDIO',
    studentsCount: 32,
    status: 'ativa',
    subjectIcon: 'math'
  },
  {
    id: 'turma-2',
    name: 'Física Básica I',
    subtitle: 'Mecânica Clássica',
    schedule: 'Ter e Qui, 10:00 - 11:40',
    scheduleDays: '1º ANO DO ENSINO MÉDIO',
    studentsCount: 28,
    status: 'ativa',
    subjectIcon: 'physics'
  },
  {
    id: 'turma-3',
    name: 'Química Orgânica',
    subtitle: 'Hidrocarbonetos e Funções',
    schedule: 'Sex, 13:00 - 14:40',
    scheduleDays: '2º ANO DO ENSINO MÉDIO',
    studentsCount: 42,
    status: 'em_pausa',
    subjectIcon: 'chemistry'
  }
];

export const STUDENT_UPCOMING_CLASSES = [
  {
    id: 'up-1',
    time: '19:00 - 20:40',
    subject: 'Arquitetura de Sistemas',
    professor: 'Prof. Dr. Silva',
    room: 'Lab 3'
  },
  {
    id: 'up-2',
    time: '21:00 - 22:40',
    subject: 'Banco de Dados II',
    professor: 'Profa. Costa',
    room: 'Sala 104'
  }
];

export const INITIAL_STUDENT_ATTENDANCE: AttendanceRecord[] = [
  {
    id: 'att-1',
    date: '14 Out',
    time: '19:00 - 20:40',
    subject: 'Estrutura de Dados',
    professor: 'Alan Turing',
    status: 'presente'
  },
  {
    id: 'att-2',
    date: '12 Out',
    time: '21:00 - 22:40',
    subject: 'Engenharia de Requisitos',
    professor: 'Margaret Hamilton',
    status: 'ausente'
  }
];

export const INITIAL_MOCK_FEED: StudentCheckIn[] = [
  {
    id: 'feed-1',
    studentName: 'Ana Beatriz Lemos',
    registrationId: '2021045',
    timestamp: 'agora',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'
  },
  {
    id: 'feed-2',
    studentName: 'Rafael Costa',
    registrationId: '2021089',
    timestamp: '2m atrás',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'
  },
  {
    id: 'feed-3',
    studentName: 'Juliana Martins',
    registrationId: '2021102',
    timestamp: '5m atrás',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'
  }/*,
  {
    id: 'feed-4',
    studentName: 'Carlos Eduardo (Sousa)',
    registrationId: '2021011',
    timestamp: '12m atrás',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'
  }*/
];

// Additional potential checkins to feed standard live simulation tick
export const POTENTIAL_CHECKINS: Omit<StudentCheckIn, 'timestamp'>[] = [
  {
    id: 'pot-1',
    studentName: 'Carlos Eduardo (Sousa)',
    registrationId: '2021011',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'
  },
  {
    id: 'pot-2',
    studentName: 'Mariana Azevedo',
    registrationId: '2021204',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'
  },
  {
    id: 'pot-3',
    studentName: 'Gabriel Peixoto',
    registrationId: '2021115',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'
  },
  {
    id: 'pot-4',
    studentName: 'Beatriz Vasquez',
    registrationId: '2021077',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'
  },
  {
    id: 'pot-5',
    studentName: 'Vinícius Rocha',
    registrationId: '2021303',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'
  }
];
