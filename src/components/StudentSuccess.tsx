import React from 'react';
import { AttendanceRecord } from '../types';
import { CheckCircle2, Navigation, Compass, Calendar, User, ArrowLeft, Home } from 'lucide-react';

interface StudentSuccessProps {
  record: Omit<AttendanceRecord, 'id'>;
  onBackToDashboard: () => void;
}

export default function StudentSuccess({ record, onBackToDashboard }: StudentSuccessProps) {
  return (
    <div className="w-full max-w-md mx-auto bg-[#f8f9ff] min-h-screen flex flex-col justify-between p-6 relative font-sans shadow-2xl border border-slate-100 rounded-3xl animate-fade-in select-none">
      
      {/* Custom Dancing Bear & Confetti Keyframes Styles */}
      <style>{`
        @keyframes bear-dance {
          0%, 100% { transform: translateY(0) rotate(-6deg) scale(1); }
          50% { transform: translateY(-10px) rotate(6deg) scale(1.05); }
        }
        @keyframes left-arm-dance {
          0%, 100% { transform: rotate(-30deg); }
          50% { transform: rotate(45deg); }
        }
        @keyframes right-arm-dance {
          0%, 100% { transform: rotate(30deg); }
          50% { transform: rotate(-45deg); }
        }
        @keyframes left-foot-dance {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-4px, -3px) rotate(-15deg); }
        }
        @keyframes right-foot-dance {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(4px, -3px) rotate(15deg); }
        }
        @keyframes musical-note-1 {
          0% { transform: translate(0, 20px) scale(0) rotate(0deg); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translate(-30px, -80px) scale(1) rotate(-35deg); opacity: 0; }
        }
        @keyframes musical-note-2 {
          0% { transform: translate(0, 20px) scale(0) rotate(0deg); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translate(30px, -70px) scale(1.1) rotate(35deg); opacity: 0; }
        }
        @keyframes badge-pop {
          0% { transform: scale(0.9); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }

        .bear-container {
          animation: bear-dance 1.4s ease-in-out infinite;
          transform-origin: bottom center;
        }
        .left-arm {
          animation: left-arm-dance 0.7s ease-in-out infinite alternate;
          transform-origin: 38px 105px;
        }
        .right-arm {
          animation: right-arm-dance 0.7s ease-in-out infinite alternate;
          transform-origin: 102px 105px;
        }
        .left-foot {
          animation: left-foot-dance 0.7s ease-in-out infinite alternate;
          transform-origin: 50px 145px;
        }
        .right-foot {
          animation: right-foot-dance 0.7s ease-in-out infinite alternate;
          transform-origin: 90px 145px;
        }
        .sparkle-note-1 {
          animation: musical-note-1 2.2s ease-out infinite;
        }
        .sparkle-note-2 {
          animation: musical-note-2 2.6s ease-out infinite 0.7s;
        }
        .badge-pulse {
          animation: badge-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>

      {/* Decorative Grid Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-25 bg-[radial-gradient(#0066ff_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)]"></div>

      {/* Spacer top */}
      <div className="h-4"></div>

      {/* Main Success Message */}
      <div className="text-center space-y-6 relative z-10 py-4">
        
        {/* Interactive Celebrating Dancing Bear Component Container */}
        <div className="relative w-full flex flex-col items-center justify-center py-2 select-none">
          
          {/* Floating Live Sparkles & Music Notes around the bear */}
          <span className="absolute text-xl sparkle-note-1 left-[25%] top-[10%] select-none pointer-events-none">🎵</span>
          <span className="absolute text-2xl sparkle-note-2 right-[25%] top-[5%] select-none pointer-events-none">🎶</span>
          <span className="absolute text-lg sparkle-note-1 right-[20%] top-[40%] select-none pointer-events-none">✨</span>
          <span className="absolute text-xl sparkle-note-2 left-[18%] top-[50%] select-none pointer-events-none">🐻</span>
          <span className="absolute text-lg sparkle-note-1 left-[32%] top-[70%] select-none pointer-events-none">🎉</span>
          <span className="absolute text-lg sparkle-note-2 right-[30%] top-[75%] select-none pointer-events-none">✨</span>

          {/* Core SVG Bear with Cute Dancing Movements */}
          <div className="w-40 h-40 flex items-center justify-center transition-all bg-sky-50/50 rounded-full border border-sky-100 shadow-inner p-2 relative">
            <svg 
              viewBox="0 0 140 160" 
              className="w-36 h-36 drop-shadow-[0_10px_15px_rgba(115,64,4,0.18)]"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Outer Bear container that vibrates side-to-side */}
              <g className="bear-container">
                
                {/* Bear Shadows */}
                <ellipse cx="70" cy="148" rx="35" ry="6" fill="#000000" fillOpacity="0.08" />

                {/* Left Foot */}
                <g className="left-foot">
                  <ellipse cx="50" cy="143" rx="14" ry="10" fill="#92400e" />
                  <ellipse cx="50" cy="141" rx="8" ry="6" fill="#fcd34d" />
                  {/* Paw pads */}
                  <circle cx="43" cy="135" r="2.5" fill="#fcd34d" />
                  <circle cx="50" cy="133" r="2.5" fill="#fcd34d" />
                  <circle cx="57" cy="135" r="2.5" fill="#fcd34d" />
                </g>

                {/* Right Foot */}
                <g className="right-foot">
                  <ellipse cx="90" cy="143" rx="14" ry="10" fill="#92400e" />
                  <ellipse cx="90" cy="141" rx="8" ry="6" fill="#fcd34d" />
                  {/* Paw pads */}
                  <circle cx="83" cy="135" r="2.5" fill="#fcd34d" />
                  <circle cx="90" cy="133" r="2.5" fill="#fcd34d" />
                  <circle cx="97" cy="135" r="2.5" fill="#fcd34d" />
                </g>

                {/* Left Hand / Arm */}
                <g className="left-arm">
                  <ellipse cx="28" cy="108" rx="12" ry="8" fill="#d97706" transform="rotate(-30 28 108)" />
                  <circle cx="20" cy="108" r="5" fill="#feb019" />
                </g>

                {/* Right Hand / Arm */}
                <g className="right-arm">
                  <ellipse cx="112" cy="108" rx="12" ry="8" fill="#d97706" transform="rotate(30 112 108)" />
                  <circle cx="120" cy="108" r="5" fill="#feb019" />
                </g>

                {/* Bear Body */}
                <rect x="36" y="88" width="68" height="52" rx="28" fill="#92400e" />
                {/* Tummy Oval */}
                <ellipse cx="70" cy="116" rx="22" ry="18" fill="#fef3c7" />
                {/* Cute belly button */}
                <circle cx="70" cy="124" r="2.5" fill="#b45309" />

                {/* Bear Left Ear */}
                <circle cx="34" cy="42" r="15" fill="#92400e" />
                <circle cx="34" cy="42" r="8" fill="#fecdd3" />

                {/* Bear Right Ear */}
                <circle cx="106" cy="42" r="15" fill="#92400e" />
                <circle cx="106" cy="42" r="8" fill="#fecdd3" />

                {/* Bear Main Head */}
                <ellipse cx="70" cy="65" rx="38" ry="32" fill="#d97706" />

                {/* Blinking Cute Eyes */}
                {/* Left Eye */}
                <circle cx="55" cy="58" r="5" fill="#1e1b4b" />
                <circle cx="53.5" cy="55.5" r="2.2" fill="#ffffff" /> {/* Eye reflection */}
                
                {/* Right Eye */}
                <circle cx="85" cy="58" r="5" fill="#1e1b4b" />
                <circle cx="83.5" cy="55.5" r="2.2" fill="#ffffff" /> {/* Eye reflection */}

                {/* Rosy Cheeks */}
                <circle cx="44" cy="68" r="5.5" fill="#f43f5e" fillOpacity="0.55" />
                <circle cx="96" cy="68" r="5.5" fill="#f43f5e" fillOpacity="0.55" />

                {/* Snout */}
                <ellipse cx="70" cy="74" rx="14" ry="10" fill="#fcd34d" />
                
                {/* Soft black nose */}
                <path d="M 65 71 Q 70 76 75 71 Z" fill="#1e1b4b" />

                {/* Cheerful Smiling Mouth */}
                <path d="M 64 77 Q 70 82 76 77" fill="none" stroke="#1e1b4b" strokeWidth="2" strokeLinecap="round" />

              </g>
            </svg>
          </div>
        </div>

        {/* Headlines */}
        <div className="space-y-2 max-w-[320px] mx-auto badge-pulse">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 border border-emerald-250 rounded-full text-emerald-800 font-extrabold text-[10px] tracking-wide uppercase select-none mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Sucesso Acadêmico
          </div>
          <h1 id="presenca-confirmada-headline" className="text-3xl font-black text-[#10b981] tracking-tight leading-none uppercase drop-shadow-xs">
            Presença Confirmada!
          </h1>
          <p className="text-xs text-[#64748b] leading-relaxed font-semibold">
            Sua participação foi consolidada na aula em tempo real. Parabéns por comparecer!
          </p>
        </div>

        {/* Metric Metadata Card */}
        <div className="bg-white border border-[#eff4ff] rounded-2xl p-5 text-left shadow-[0_8px_24px_rgba(16,185,129,0.02)] space-y-4">
          
          {/* Item 1: Disciplina */}
          <div className="flex items-start gap-3 pb-3.5 border-b border-[#f8f9ff]">
            <div className="w-8 h-8 rounded-lg bg-[#f0f6ff] text-[#0066ff] flex items-center justify-center">
              <Compass className="w-4 h-4 text-[#0066ff]" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block">Disciplina</span>
              <strong className="text-xs font-bold text-[#0b1c30]">{record.subject}</strong>
            </div>
          </div>

          {/* Item 2: Professor */}
          <div className="flex items-start gap-3 pb-3.5 border-b border-[#f8f9ff]">
            <div className="w-8 h-8 rounded-lg bg-emerald-55 text-emerald-600 flex items-center justify-center">
              <User className="w-4 h-4 text-[#006645]" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block">Professor</span>
              <strong className="text-xs font-bold text-[#0b1c30]">{record.professor}</strong>
            </div>
          </div>

          {/* Item 3: Data e Horário */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block font-sans">Data e Horário</span>
              <strong className="text-xs font-bold text-[#0b1c30]">Hoje, {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} AM</strong>
            </div>
          </div>

        </div>
      </div>

      {/* Primary Action Button Bottom */}
      <div className="pt-6 relative z-10">
        <button
          onClick={onBackToDashboard}
          id="btn-success-back-home"
          className="w-full h-12 bg-[#0066ff] hover:bg-[#0054d6] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#0066ff]/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Home className="w-4 h-4" />
          Voltar ao Início
        </button>
      </div>

    </div>
  );
}
