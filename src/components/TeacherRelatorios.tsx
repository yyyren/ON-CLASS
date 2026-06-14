import React, { useState } from 'react';
import { Download, FileText, Check, AlertCircle, Sparkles, Sliders } from 'lucide-react';
import { Turma } from '../types';

interface TeacherRelatoriosProps {
  turmas?: Turma[];
}

export default function TeacherRelatorios({ turmas }: TeacherRelatoriosProps) {
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null);

  const simulateDownload = (type: 'pdf' | 'excel') => {
    setDownloading(type);
    setTimeout(() => {
      setDownloading(null);
      alert(`Relatório OnClass exportado com sucesso no formato ${type.toUpperCase()}!`);
    }, 1500);
  };

  // Coordinates for the 6-months SVG line chart (Jun, Jul, Ago, Set, Out, Nov)
  // Values representing visually: [65%, 78%, 70%, 88%, 80%, 92%]
  const chartPoints = [
    { name: 'Jun', value: 65, x: 50, y: 150 },
    { name: 'Jul', value: 78, x: 130, y: 110 },
    { name: 'Ago', value: 70, x: 210, y: 130 },
    { name: 'Set', value: 88, x: 290, y: 80 },
    { name: 'Out', value: 80, x: 370, y: 100 },
    { name: 'Nov', value: 92, x: 450, y: 65 }
  ];

  // Map coordinates to SVG path "d" string
  const pathD = `M ${chartPoints.map(p => `${p.x} ${p.y}`).join(' L ')}`;
  const areaD = `${pathD} L 450 210 L 50 210 Z`; // for shaded background area

  const colors = ['bg-[#0066ff]', 'bg-[#10b981]', 'bg-[#8b5cf6]', 'bg-[#f59e0b]', 'bg-[#ec4899]'];
  const disciplines = turmas && turmas.length > 0
    ? turmas.map((t, idx) => ({
        name: t.name,
        value: 75 + (idx * 4 + 3) % 21, // generate believable attendance scores matching classes
        color: colors[idx % colors.length]
      }))
    : [
        { name: 'Matemática Avançada', value: 92, color: 'bg-[#0066ff]' },
        { name: 'Física Clássica / Quântica', value: 85, color: 'bg-[#0050cb]' },
        { name: 'História Contemporânea', value: 96, color: 'bg-[#10b981]' },
        { name: 'Literatura Clássica', value: 71, color: 'bg-[#ba1a1a]' }
      ];

  return (
    <div className="space-y-6 font-sans">
      {/* 1. TOP HEADER AND EXPORTS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#f1f5f9] pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0b1c30]">Relatórios</h1>
          <p className="text-sm text-[#64748b] mt-1">Visão analítica de engajamento e frequência geral das turmas.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => simulateDownload('pdf')}
            disabled={downloading !== null}
            className="flex-1 sm:flex-none h-10 px-4 bg-white border border-[#dde3ec] hover:border-[#0066ff] text-[#424656] hover:text-[#0066ff] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-[#ba1a1a]" />
            {downloading === 'pdf' ? 'Exportando...' : 'Exportar PDF'}
          </button>

          <button
            onClick={() => simulateDownload('excel')}
            disabled={downloading !== null}
            className="flex-1 sm:flex-none h-10 px-4 bg-white border border-[#dde3ec] hover:border-[#0066ff] text-[#424656] hover:text-[#0066ff] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-[#10b981]" />
            {downloading === 'excel' ? 'Exportando...' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      {/* 2. AVERAGE CARD HERO */}
      <div className="bg-white rounded-3xl border border-[#eff4ff] p-8 shadow-[0_8px_32px_rgba(0,102,255,0.02)] relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
        
        {/* Absolute Background element */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-radial from-[#e5eeff] to-transparent opacity-30 select-none pointer-events-none"></div>

        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Frequência Global Média</span>
          <div className="flex items-baseline gap-3">
            <h2 className="text-5xl font-black text-[#0066ff]" id="global-freq">87.4%</h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e1ffec] text-[#006645]">
              ↗ +2.1% vs mês anterior
            </span>
          </div>
        </div>

        {/* Dynamic mini bar graph */}
        <div className="h-16 flex items-end gap-2.5 w-full md:w-auto pt-4 md:pt-0">
          <div className="w-8 h-8 md:h-10 bg-[#dde3ec] rounded-md transition-all"></div>
          <div className="w-8 h-10 md:h-12 bg-[#dde3ec] rounded-md transition-all"></div>
          <div className="w-8 h-12 md:h-14 bg-[#dde3ec] rounded-md transition-all"></div>
          <div className="w-8 h-14 md:h-16 bg-[#0066ff] rounded-md transition-all relative">
            <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-[9px] font-bold bg-[#0b1c30] text-white px-1 rounded">Nov</span>
          </div>
        </div>
      </div>

      {/* 3. CORE CHARTS GRID (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Group A: Frequência por Disciplina */}
        <div className="bg-white rounded-3xl border border-[#eff4ff] p-7 shadow-[0_4px_24px_rgba(0,102,255,0.01)] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6 border-b border-[#f1f5f9] pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#0b1c30]">Frequência por Disciplina</h3>
                <p className="text-xs text-[#64748b]">Metas estabelecidas versus real letivo</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                <Sliders className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-5">
              {disciplines.map((disc, idx) => (
                <div key={idx} className="space-y-1.5 focus:outline-none">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#0b1c30]">{disc.name}</span>
                    <span className="text-[#0b1c30] font-bold">{disc.value}%</span>
                  </div>
                  {/* Progress rail */}
                  <div className="w-full h-3 bg-[#f0f6ff] rounded-full overflow-hidden relative">
                    <div
                      className={`h-full ${disc.color} rounded-full transition-all duration-1000`}
                      style={{ width: `${disc.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-5 border-t border-[#f1f5f9] mt-6 flex items-center gap-2 text-[11px] text-[#64748b]">
            <AlertCircle className="w-4 h-4 text-[#ba1a1a]" />
            <span>Frequência mínima obrigatória exigida por lei: <strong className="text-[#0b1c30]">75%</strong></span>
          </div>
        </div>

        {/* Group B: Presença Mensal Line Trend */}
        <div className="bg-white rounded-3xl border border-[#eff4ff] p-7 shadow-[0_4px_24px_rgba(0,102,255,0.01)]">
          <div className="flex justify-between items-center mb-6 border-b border-[#f1f5f9] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0b1c30]">Presença Mensal</h3>
              <p className="text-xs text-[#64748b]">Acompanhamento temporal dos check-ins</p>
            </div>
            {/* Filter selector dropdown mockup */}
            <select className="h-8 pl-3 pr-8 bg-slate-50 border border-[#dde3ec] text-xs font-bold rounded-lg outline-none cursor-pointer">
              <option>Últimos 6 meses</option>
              <option>Últimos 3 meses</option>
              <option>Ano Letivo</option>
            </select>
          </div>

          {/* Precision SVG Line Graph */}
          <div className="relative w-full overflow-hidden flex items-center justify-center bg-[#f8f9ff]/30 rounded-2xl p-4 border border-[#eff4ff]">
            <svg
              viewBox="0 0 500 240"
              className="w-full h-auto max-h-[220px]"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Grid Horizontal Guidelines */}
              <line x1="40" y1="65" x2="470" y2="65" stroke="#eff4ff" strokeWidth="1" strokeDasharray="3,3" />
              <line x1="40" y1="110" x2="470" y2="110" stroke="#eff4ff" strokeWidth="1" strokeDasharray="3,3" />
              <line x1="40" y1="150" x2="470" y2="150" stroke="#eff4ff" strokeWidth="1" strokeDasharray="3,3" />
              <line x1="40" y1="210" x2="470" y2="210" stroke="#eff4ff" strokeWidth="1" />

              {/* Shaded Area underneath the path line */}
              <path
                d={areaD}
                fill="url(#gradient-blue-area)"
                opacity="0.35"
              />

              {/* Main Connecting Path Line */}
              <path
                d={pathD}
                fill="none"
                stroke="#0066ff"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Glow filter definition */}
              <defs>
                <linearGradient id="gradient-blue-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0066ff" />
                  <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>
              </defs>

              {/* Active data dots coordinates circles */}
              {chartPoints.map((point, index) => (
                <g key={index} className="group/dot cursor-pointer">
                  {/* Outer glow aura */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="8"
                    fill="#0066ff"
                    opacity="0.15"
                    className="hover:opacity-30 transition-opacity"
                  />
                  {/* Inner exact coordinate node */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="4.5"
                    fill="#ffffff"
                    stroke="#0066ff"
                    strokeWidth="3.5"
                  />
                  {/* Monthly abbreviations labels below axis */}
                  <text
                    x={point.x}
                    y="232"
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="inherit"
                  >
                    {point.name}
                  </text>
                  {/* Hover box tooltip containing coordinates metrics */}
                  <text
                    x={point.x}
                    y={point.y - 14}
                    textAnchor="middle"
                    fill="#0b1c30"
                    fontSize="9.5"
                    fontWeight="800"
                    fontFamily="inherit"
                    className="opacity-0 group-hover/dot:opacity-100 transition-opacity duration-200"
                  >
                    {point.value}%
                  </text>
                </g>
              ))}

              {/* Axis values labels */}
              <text x="35" y="69" textAnchor="end" fill="#c2c6d8" fontSize="9.5" fontWeight="600">90%</text>
              <text x="35" y="114" textAnchor="end" fill="#c2c6d8" fontSize="9.5" fontWeight="600">80%</text>
              <text x="35" y="154" textAnchor="end" fill="#c2c6d8" fontSize="9.5" fontWeight="600">70%</text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
