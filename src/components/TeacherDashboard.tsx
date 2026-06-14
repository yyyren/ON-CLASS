import React, { useState } from 'react';
import { Turma } from '../types';
import { Search, Plus, BookOpen, GraduationCap, Compass, Beaker, FileSpreadsheet, Settings, Calendar, HelpCircle, LogOut } from 'lucide-react';

interface TeacherDashboardProps {
  turmas: Turma[];
  onAddTurma: (newTurma: Omit<Turma, 'id'>) => void;
  onSelectTurma: (turma: Turma) => void;
  onStartChamada: (turma: Turma) => void;
}

export default function TeacherDashboard({ turmas, onAddTurma, onSelectTurma, onStartChamada }: TeacherDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form Fields
  const [className, setClassName] = useState('');
  const [classSubtitle, setClassSubtitle] = useState('');
  const [classGrade, setClassGrade] = useState('3º ANO DO ENSINO MÉDIO');
  const [classSchedule, setClassSchedule] = useState('');
  const [classStudents, setClassStudents] = useState(30);
  const [classIcon, setClassIcon] = useState<'math' | 'physics' | 'chemistry' | 'code'>('math');

  const filteredTurmas = turmas.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subtitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className || !classSchedule) return;

    onAddTurma({
      name: className,
      subtitle: classSubtitle,
      schedule: classSchedule,
      scheduleDays: classGrade,
      studentsCount: Number(classStudents),
      status: 'ativa',
      subjectIcon: classIcon,
    });

    // Reset Form
    setClassName('');
    setClassSubtitle('');
    setClassSchedule('');
    setShowCreateModal(false);
  };

  const getSubjectIconRenderer = (iconType: string) => {
    switch (iconType) {
      case 'math':
        return (
          <div className="w-10 h-10 bg-[#e5eeff] text-[#0066ff] rounded-xl flex items-center justify-center font-bold text-lg">
            ∑
          </div>
        );
      case 'physics':
        return (
          <div className="w-10 h-10 bg-[#e1ffec] text-[#006645] rounded-xl flex items-center justify-center font-bold text-lg">
            <Compass className="w-5.5 h-5.5" />
          </div>
        );
      case 'chemistry':
        return (
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-bold text-lg">
            <Beaker className="w-5.5 h-5.5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-bold text-lg">
            <BookOpen className="w-5.5 h-5.5" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header section with Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#f1f5f9] pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0b1c30]">Minhas Turmas</h1>
          <p className="text-sm text-[#64748b] mt-1">Gerencie suas salas de aula, alunos e conteúdos ativos.</p>
        </div>
        
        {/* Dynamic controls */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-initial">
            <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-[#64748b]" />
            <input
              id="input-search-classes"
              type="text"
              placeholder="Buscar turma..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-64 h-10 pl-10 pr-4 bg-white border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none"
            />
          </div>
          
          <button
            id="btn-create-class-top"
            onClick={() => setShowCreateModal(true)}
            className="h-10 bg-[#0066ff] hover:bg-[#0054d6] text-white px-4 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-[#0066ff]/10 focus:ring-2 focus:ring-[#0066ff]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            Criar Turma
          </button>
        </div>
      </div>

      {/* Turmas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTurmas.map((turma) => (
          <div
            key={turma.id}
            onClick={() => onSelectTurma(turma)}
            className="group block bg-white border border-[#eff4ff] hover:border-[#0066ff]/20 rounded-2xl p-6 transition-all duration-350 cursor-pointer relative shadow-[0_4px_20px_rgba(0,102,255,0.02)] hover:shadow-[0_12px_32px_rgba(0,102,255,0.06)]"
          >
            {/* Top Row with Icon, Edit and Status badge */}
            <div className="flex justify-between items-start mb-4">
              {getSubjectIconRenderer(turma.subjectIcon)}
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                  turma.status === 'ativa'
                    ? 'bg-[#e1ffec] text-[#006645]'
                    : 'bg-[#dde3ec] text-[#5e656d]'
                }`}>
                  {turma.status === 'ativa' ? 'Ativa' : 'Em Pausa'}
                </span>
              </div>
            </div>

            {/* Core titles */}
            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#0b1c30] group-hover:text-[#0066ff] transition-colors line-clamp-1">{turma.name}</h3>
              <p className="text-xs text-[#64748b] font-medium mt-0.5">{turma.scheduleDays}</p>
            </div>

            {/* Class Details */}
            <div className="space-y-2.5 pt-4 border-t border-[#f8f9ff] text-xs text-[#64748b] bg-slate-50/20 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#64748b]/80" />
                <span className="font-medium truncate">{turma.subtitle}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#64748b]/80" />
                <span className="font-semibold text-[#0b1c30]">{turma.schedule}</span>
              </div>
            </div>

            {/* Bottom Row showing Students, and Quick Call Action */}
            <div className="flex justify-between items-center mt-5 pt-3 border-t border-[#f1f5f9]">
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#0066ff]/10 text-[#0066ff] border border-white text-[8px] font-bold flex items-center justify-center">🎓</div>
                  <div className="w-5 h-5 rounded-full bg-emerald-150 text-emerald-700 border border-white text-[8px] font-bold flex items-center justify-center">✔</div>
                </div>
                <span className="text-xs text-[#64748b] font-bold">
                  {turma.studentsCount} <span className="font-medium text-[#c2c6d8]/85">alunos</span>
                </span>
              </div>

              {turma.status === 'ativa' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartChamada(turma);
                  }}
                  id={`btn-call-trigger-${turma.id}`}
                  className="px-3 h-8 bg-[#0066ff] hover:bg-[#0054d6] text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-all shadow-sm shadow-[#0066ff]/5 hover:shadow-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Chamada
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Empty Box - Nova Turma */}
        <div
          onClick={() => setShowCreateModal(true)}
          className="border-2 border-dashed border-[#dce9ff] hover:border-[#0066ff] rounded-2xl flex flex-col items-center justify-center text-center p-8 transition-colors cursor-pointer min-h-[250px] group"
        >
          <div className="w-12 h-12 rounded-full bg-[#f0f6ff] text-[#0066ff] group-hover:bg-[#0066ff] group-hover:text-white flex items-center justify-center transition-all mb-4">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h4 className="text-sm font-bold text-[#0b1c30] group-hover:text-[#0066ff] transition-colors">Criar Nova Turma</h4>
          <p className="text-xs text-[#64748b] max-w-[200px] mt-1.5 leading-relaxed">Adicione uma nova disciplina ao seu semestre letivo.</p>
        </div>
      </div>

      {/* CREATE CLASS MODAL POPUP */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#eff4ff] p-6 animate-scale-up">
            <div className="flex justify-between items-center mb-5 border-b border-[#f1f5f9] pb-3">
              <h3 className="text-lg font-bold text-[#0b1c30]">Criar Nova Turma</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[#64748b] hover:text-[#0b1c30] text-sm cursor-pointer font-bold px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748b]" htmlFor="form-col-name">
                  Nome da Disciplina
                </label>
                <input
                  id="form-col-name"
                  type="text"
                  required
                  placeholder="Ex: Engenharia de Software I"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full h-11 px-4 bg-[#f8f9ff]/50 border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none"
                />
              </div>

              {/* Course details */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748b]" htmlFor="form-col-sub">
                  Subtítulo / Ementa
                </label>
                <input
                  id="form-col-sub"
                  type="text"
                  placeholder="Ex: Padrões de Projeto e Refatoração"
                  value={classSubtitle}
                  onChange={(e) => setClassSubtitle(e.target.value)}
                  className="w-full h-11 px-4 bg-[#f8f9ff]/50 border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none"
                />
              </div>

              {/* Grade */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748b]" htmlFor="form-col-grade">
                  Nível / Turma
                </label>
                <select
                  id="form-col-grade"
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                  className="w-full h-11 px-4 bg-[#f8f9ff]/50 border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none cursor-pointer"
                >
                  <option value="3º ANO DO ENSINO MÉDIO">3º Ano do Ensino Médio</option>
                  <option value="2º ANO DO ENSINO MÉDIO">2º Ano do Ensino Médio</option>
                  <option value="1º ANO DO ENSINO MÉDIO">1º Ano do Ensino Médio</option>
                  <option value="CURSO SUPERIOR - 1º SEM">Ensino Superior - 1º Semestre</option>
                  <option value="CURSO SUPERIOR - 6º SEM">Ensino Superior - 6º Semestre</option>
                </select>
              </div>

              {/* Schedule and students split */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748b]" htmlFor="form-col-sched">
                    Horário de Aula
                  </label>
                  <input
                    id="form-col-sched"
                    type="text"
                    required
                    placeholder="Seg e Qua, 19:00 - 20:40"
                    value={classSchedule}
                    onChange={(e) => setClassSchedule(e.target.value)}
                    className="w-full h-11 px-4 bg-[#f8f9ff]/50 border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748b]" htmlFor="form-col-stud">
                    Total de Alunos
                  </label>
                  <input
                    id="form-col-stud"
                    type="number"
                    min="1"
                    max="100"
                    value={classStudents}
                    onChange={(e) => setClassStudents(Number(e.target.value))}
                    className="w-full h-11 px-4 bg-[#f8f9ff]/50 border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none"
                  />
                </div>
              </div>

              {/* Icon Type Picker */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
                  Ícone Representativo
                </label>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {(['math', 'physics', 'chemistry', 'code'] as const).map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setClassIcon(ic)}
                      className={`py-2 px-3 border rounded-xl text-xs font-bold flex items-center justify-center capitalize cursor-pointer ${
                        classIcon === ic
                          ? 'border-[#0066ff] bg-[#f0f6ff] text-[#0066ff]'
                          : 'border-[#c2c6d8] text-[#64748b] hover:bg-[#f8f9ff]'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-[#f1f5f9] mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 h-10 bg-white hover:bg-[#f8f9ff] text-[#64748b] border border-[#dce9ff] font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-confirm-create-class"
                  className="px-5 h-10 bg-[#0066ff] hover:bg-[#0054d6] text-white font-semibold text-xs rounded-xl cursor-pointer shadow-md shadow-[#0066ff]/10"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
