import React, { useState, useEffect, useRef } from 'react';
import { Turma, StudentCheckIn, ActiveChamada } from '../types';
import { Clock, Play, Square, CheckCircle, XCircle, Users, TrendingUp, RefreshCw, ChevronRight, List } from 'lucide-react';
import { INITIAL_MOCK_FEED, POTENTIAL_CHECKINS } from '../data/mockData';

interface TeacherChamadaProps {
  turma: Turma;
  onEncerrarChamada: (stats: { present: number; total: number }) => void;
}

export default function TeacherChamada({ turma, onEncerrarChamada }: TeacherChamadaProps) {
  // Statistics state starting exactly like screenshots but flexible for simulator
  const [presentes, setPresentes] = useState(32);
  const totalTurma = turma.studentsCount;
  const [ausentes, setAusentes] = useState(totalTurma - 32 > 0 ? totalTurma - 32 : 8);
  const frequencyPercent = Math.round((presentes / totalTurma) * 100);

  // Timer: 10s countdown
  const [timeLeft, setTimeLeft] = useState(10);
  const [qrCodeSalt, setQrCodeSalt] = useState('MAIN_QR_HASH_INIT');

  // Real-time Feed State
  const [feedItems, setFeedItems] = useState<StudentCheckIn[]>([]);
  
  const potentialQueue = useRef([...POTENTIAL_CHECKINS]);

  // QR Code generator simulation - renders different patterns based on state of salt
  const generateMockQrPoints = (salt: string) => {
    // Generates a simple beautiful 2D QR matrix as columns
    const columns = [];
    const seed = salt.charCodeAt(0) + salt.charCodeAt(salt.length - 1);
    for (let i = 0; i < 21; i++) {
      const row = [];
      for (let j = 0; j < 21; j++) {
        // Build corners (standard QR markers)
        const isCorner = 
          (i < 7 && j < 7) || 
          (i < 7 && j > 13) || 
          (i > 13 && j < 7);
        if (isCorner) {
          // outer bound marker
          const isOuter = (i === 0 || i === 6 || j === 0 || j === 6 || (i === 14 && (j === 0 || j === 6)) || (i === 20 && (j === 0 || j === 6)) || (j === 14 && (i === 0 || i === 6)) || (j === 20 && (i === 0 || i === 6)));
          const isInner = (i >= 2 && i <= 4 && j >= 2 && j <= 4) || (i >= 16 && i <= 18 && j >= 2 && j <= 4) || (i >= 2 && i <= 4 && j >= 16 && j <= 18);
          row.push(isOuter || isInner ? 1 : 0);
        } else {
          // pseudo-random generation based on seed and coordinates
          const value = ((i * j * seed) + (i + j)) % 3 === 0 || ((i + j + seed) % 5 === 0);
          row.push(value ? 1 : 0);
        }
      }
      columns.push(row);
    }
    return columns;
  };

  // Timer Refresher
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Regenerate QR
          setQrCodeSalt('QR_KEY_' + Math.random().toString(36).substring(3, 8).toUpperCase());
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load and update live check-ins from localStorage in real time
  useEffect(() => {
    const liveKey = `onclass_live_checks_${turma.id}`;
    
    // Set initial mock list if none exists yet so it isn't blank
    const saved = localStorage.getItem(liveKey);
    if (!saved) {
      localStorage.setItem(liveKey, JSON.stringify(INITIAL_MOCK_FEED));
    }

    const updateFeed = () => {
      const currentSaved = localStorage.getItem(liveKey);
      if (currentSaved) {
        try {
          const list = JSON.parse(currentSaved);
          setFeedItems(list);
          setPresentes(list.length);
          setAusentes(Math.max(0, totalTurma - list.length));
        } catch (e) {
          console.warn("Could not parse live feed:", e);
        }
      }
    };

    updateFeed();
    const interval = setInterval(updateFeed, 1000);
    return () => clearInterval(interval);
  }, [turma.id, totalTurma]);

  // Manually trigger simulated student check-in so that it feeds into the live synced localStorage
  const handleInjectSimulatedStudent = () => {
    if (potentialQueue.current.length > 0) {
      const nextStudent = potentialQueue.current.shift();
      if (nextStudent) {
        const newItem: StudentCheckIn = {
          id: nextStudent.id,
          studentName: nextStudent.studentName,
          registrationId: nextStudent.registrationId,
          timestamp: 'agora',
          avatarUrl: nextStudent.avatarUrl
        };

        const liveKey = `onclass_live_checks_${turma.id}`;
        try {
          const currentSaved = localStorage.getItem(liveKey);
          let list = currentSaved ? JSON.parse(currentSaved) : [];
          
          // Shift times on old elements
          list = list.map((item: StudentCheckIn) => {
            if (item.timestamp === 'agora') return { ...item, timestamp: '1m atrás' };
            if (item.timestamp === '1m atrás') return { ...item, timestamp: '3m atrás' };
            if (item.timestamp === '3m atrás') return { ...item, timestamp: '5m atrás' };
            return item;
          });

          // Prepend new simulation
          list.unshift(newItem);
          localStorage.setItem(liveKey, JSON.stringify(list));
        } catch (e) {
          console.warn("Could not write injected simulation profile", e);
        }
      }
    } else {
      alert("Todos os alunos de teste disponíveis já entraram!");
    }
  };

  const qrMatrix = generateMockQrPoints(qrCodeSalt);

  return (
    <div className="space-y-6 font-sans">
      {/* 1. TOP HEADER COCKPIT */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#f1f5f9] pb-5">
        <div>
          {/* Status Indicators */}
          <div className="flex items-center gap-3 mb-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#e1ffec] text-[#006645] animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
              Em Andamento
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#64748b]">
              <Clock className="w-3.5 h-3.5 text-[#64748b]" />
              14:00 - 15:40
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0b1c30]">Ciência da Computação 401</h1>
          <p className="text-sm text-[#c2c6d8] mt-1">
            <span className="text-[#64748b] font-semibold">{turma.name}</span>
            <span className="mx-2 text-[#c2c6d8]">•</span>
            <span className="text-[#64748b] font-medium">{turma.subtitle || 'Estruturas de Dados Avançadas'} • Sala B-12</span>
          </p>
        </div>

        <button
          id="btn-stop-call"
          onClick={() => onEncerrarChamada({ present: presentes, total: totalTurma })}
          className="h-11 bg-white hover:bg-[#ffdad6] text-[#ba1a1a] hover:text-[#ba1a1a] border border-[#ffdad6] px-5 font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer"
        >
          <Square className="w-4 h-4 fill-current text-[#ba1a1a]" />
          Encerrar Chamada
        </button>
      </div>

      {/* 2. STATS BAR BLOCK (4 columns) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Presentes */}
        <div className="bg-white rounded-2xl border border-[#eff4ff] p-5 shadow-[0_4px_16px_rgba(0,102,255,0.01)] flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-2xl bg-[#e1ffec] text-[#006645] flex items-center justify-center shadow-sm">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-[#64748b] uppercase block">Presentes</span>
            <span className="text-2.5xl font-extrabold text-[#0b1c30]" id="stat-present-count">{presentes} <span className="text-xs text-[#64748b] font-medium">alunos</span></span>
          </div>
        </div>

        {/* Ausentes */}
        <div className="bg-white rounded-2xl border border-[#eff4ff] p-5 shadow-[0_4px_16px_rgba(0,102,255,0.01)] flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-2xl bg-[#ffdad6] text-[#93000a] flex items-center justify-center shadow-sm">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-[#64748b] uppercase block">Ausentes</span>
            <span className="text-2.5xl font-extrabold text-[#0b1c30]">{ausentes} <span className="text-xs text-[#64748b] font-medium">alunos</span></span>
          </div>
        </div>

        {/* Total matriculados */}
        <div className="bg-white rounded-2xl border border-[#eff4ff] p-5 shadow-[0_4px_16px_rgba(0,102,255,0.01)] flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-2xl bg-[#f0f6ff] text-[#0066ff] flex items-center justify-center shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-[#64748b] uppercase block">Total da Turma</span>
            <span className="text-2.5xl font-extrabold text-[#0b1c30]">{totalTurma} <span className="text-xs text-[#64748b] font-medium">matriculados</span></span>
          </div>
        </div>

        {/* Frequência */}
        <div className="bg-white rounded-2xl border border-[#eff4ff] p-5 shadow-[0_4px_16px_rgba(0,102,255,0.01)] flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-[#64748b] uppercase block">Frequência</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2.5xl font-extrabold text-[#0b1c30]">{frequencyPercent}%</span>
              <span className="text-[10px] font-bold bg-[#e1ffec] text-[#006645] px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                ↗+2%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CORE TWO PANEL COCKPIT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: ACTIVE DYNAMIC QR CODE DISPLAY */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#eff4ff] p-8 flex flex-col items-center justify-center gap-6 min-h-[460px] shadow-[0_12px_40px_rgba(0,102,255,0.02)]">
          
          {/* Outer Border Box to hold QR Frame exactly styled as image */}
          <div className="p-4 bg-white border-4 border-[#0066ff]/5 rounded-3xl relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#0066ff] rounded-tl-xl -mt-1 -ml-1"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#0066ff] rounded-tr-xl -mt-1 -mr-1"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#0066ff] rounded-bl-xl -ml-1 -mb-1"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#0066ff] rounded-br-xl -mr-1 -mb-1"></div>
            
            {/* The QR Canvas wrapper */}
            <div className="w-56 h-56 bg-white p-2 relative flex items-center justify-center select-none overflow-hidden rounded-xl">
              <div className="grid grid-cols-21 grid-rows-21 w-full h-full gap-[2px]">
                {qrMatrix.map((row, rIdx) =>
                  row.map((point, pIdx) => (
                    <div
                      key={`${rIdx}-${pIdx}`}
                      className={`rounded-[1px] transition-all duration-300 ${
                        point === 1 
                          ? 'bg-[#0b1c30]' 
                          : 'bg-transparent'
                      }`}
                    />
                  ))
                )}
              </div>
              
              {/* Graduate Cap Central Brand Icon */}
              <div className="absolute inset-0 m-auto w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-[#e5eeff]">
                <div className="w-10 h-10 bg-[#0066ff] text-white rounded-xl flex items-center justify-center">
                  <span className="text-xl">🎓</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic timer loop count */}
          <div className="relative">
            <button className="h-12 px-6 bg-[#f0f6ff] text-[#0066ff] hover:bg-[#e5eeff] rounded-2xl flex items-center justify-center gap-3 border border-[#dce9ff] font-bold text-sm transition-all focus:outline-none">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent border-[#0066ff] animate-spin flex items-center justify-center text-[10px] font-extrabold font-mono">
                {timeLeft}
              </div>
              <span className="text-xs text-[#0b1c30] font-bold">
                Atualizando Código ({timeLeft}s)
              </span>
              <span className="text-[11px] text-[#64748b] font-medium hidden sm:inline">
                • Aponte a câmera do aplicativo do aluno
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: REAL TIME ACCESS LOGS FEED */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-[#eff4ff] p-6 flex flex-col justify-between shadow-[0_12px_40px_rgba(0,102,255,0.02)]">
          <div>
            {/* Header Feed */}
            <div className="flex justify-between items-center mb-5 border-b border-[#f1f5f9] pb-3.5">
              <div>
                <h3 className="text-sm font-bold text-[#0b1c30] uppercase tracking-wider">Feed em Tempo Real</h3>
                <p className="text-xs text-[#64748b] mt-0.5">Últimos registros de presença efetuados</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInjectSimulatedStudent}
                  title="Injetar aluno de simulação no feed ativo"
                  className="bg-[#f0f6ff] hover:bg-[#e5eeff] text-[#0066ff] py-1 px-2.5 text-[10px] tracking-tight rounded-lg font-extrabold border border-[#dce9ff] transition-all cursor-pointer shadow-sm hover:shadow"
                >
                  + Injetar Aluno
                </button>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10b981]"></span>
                </span>
              </div>
            </div>

            {/* List entries */}
            <div className="space-y-4">
              {feedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#f1f5f9] hover:bg-[#f8f9ff] transition-colors duration-200"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={item.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=facearea&facepad=2&w=128&h=128&q=80'}
                      alt={item.studentName}
                      className="w-9 h-9 rounded-full object-cover border border-[#eff4ff]"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-[#0b1c30] line-clamp-1">{item.studentName}</h4>
                      <p className="text-[10px] text-[#64748b] font-medium mt-0.5">Matrícula: {item.registrationId}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#64748b] font-semibold">{item.timestamp}</span>
                    <div className="w-6 h-6 rounded-full bg-[#e1ffec] text-[#006645] flex items-center justify-center font-bold text-xs shadow-sm">
                      ✔
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer list launcher */}
          <div className="pt-4 border-t border-[#f1f5f9] mt-6 flex justify-center">
            <button className="text-xs font-bold text-[#0066ff] hover:underline flex items-center gap-1 cursor-pointer">
              <List className="w-4 h-4" />
              Ver Lista Completa ({presentes}/{totalTurma} Alunos)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
