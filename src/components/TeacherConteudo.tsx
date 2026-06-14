import React, { useState, useEffect } from 'react';
import { Turma, MaterialTurma } from '../types';
import { BookOpen, AlertCircle, Plus, Trash2, Calendar, FileText, Download, CheckCircle, ExternalLink, HelpCircle } from 'lucide-react';

interface TeacherConteudoProps {
  turmas: Turma[];
}

export default function TeacherConteudo({ turmas }: TeacherConteudoProps) {
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');
  const [materials, setMaterials] = useState<MaterialTurma[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'slide' | 'atividade' | 'material'>('slide');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [points, setPoints] = useState('10');
  const [dueDate, setDueDate] = useState('');

  // Initial load
  useEffect(() => {
    if (turmas && turmas.length > 0) {
      setSelectedTurmaId(turmas[0].id);
    }

    const saved = localStorage.getItem('onclass_materials_list');
    if (saved) {
      try {
        setMaterials(JSON.parse(saved));
      } catch (e) {
        console.warn("Could not parse materials", e);
      }
    } else {
      // Seed initial high-quality mock materials
      const initialSeed: MaterialTurma[] = [
        {
          id: 'mat-1',
          turmaId: 'turma-1', // Matematica avancada
          title: 'Slide Cap 1: Espaços Vetoriais e Álgebra Linear',
          type: 'slide',
          linkUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&auto=format&fit=crop&q=80',
          description: 'Apresentação utilizada na primeira aula da disciplina contendo definições de subespaços, base, dimensão e coordenadas.',
          dateAdded: '12/06/2026'
        },
        {
          id: 'mat-2',
          turmaId: 'turma-1',
          title: 'Lista de Exercícios 1 - Determinantes e Sistemas',
          type: 'atividade',
          description: 'Desenvolver as questões 1 a 10 do capítulo 2 da bibliografia básica. Entregar em PDF assinado.',
          points: 10,
          dueDate: '19/06/2026',
          dateAdded: '13/06/2026'
        },
        {
          id: 'mat-3',
          turmaId: 'turma-2', // Fisica Classica
          title: 'Slide Cap 2: Cinemática Escalar e Vetorial',
          type: 'slide',
          linkUrl: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=800&auto=format&fit=crop&q=80',
          description: 'Conteúdo de movimentos retilíneos, aceleração vetorial e lançamento de projéteis com simulação integrada.',
          dateAdded: '12/06/2026'
        },
        {
          id: 'mat-4',
          turmaId: 'turma-2',
          title: 'Atividade Prática: Análise de Lançamento de Projéteis',
          type: 'atividade',
          description: 'Usando o simulador PhET Física da Colorado, registrar os dados de lançamento em 30º, 45º e 60º e entregar as conclusões escritas.',
          points: 15,
          dueDate: '22/06/2026',
          dateAdded: '14/06/2026'
        }
      ];
      setMaterials(initialSeed);
      localStorage.setItem('onclass_materials_list', JSON.stringify(initialSeed));
    }
  }, [turmas]);

  const saveMaterials = (updated: MaterialTurma[]) => {
    setMaterials(updated);
    localStorage.setItem('onclass_materials_list', JSON.stringify(updated));
  };

  const handleCreateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedTurmaId) return;

    const newMaterial: MaterialTurma = {
      id: `mat-user-${Date.now()}`,
      turmaId: selectedTurmaId,
      title: title.trim(),
      type,
      description: description.trim(),
      linkUrl: linkUrl.trim() || undefined,
      points: type === 'atividade' ? Number(points) : undefined,
      dueDate: type === 'atividade' ? (dueDate ? new Date(dueDate).toLocaleDateString('pt-BR') : undefined) : undefined,
      dateAdded: new Date().toLocaleDateString('pt-BR')
    };

    const updated = [newMaterial, ...materials];
    saveMaterials(updated);

    // Reset Form
    setTitle('');
    setType('slide');
    setDescription('');
    setLinkUrl('');
    setPoints('10');
    setDueDate('');
    setShowAddModal(false);
  };

  const handleDeleteMaterial = (id: string) => {
    if (confirm("Deseja realmente remover este material? Alunos perderão o acesso.")) {
      const updated = materials.filter(m => m.id !== id);
      saveMaterials(updated);
    }
  };

  const filteredMaterials = materials.filter(m => m.turmaId === selectedTurmaId);
  const activeTurma = turmas.find(t => t.id === selectedTurmaId);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#f1f5f9] pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0b1c30]">Conteúdos & Materiais</h1>
          <p className="text-sm text-[#64748b] mt-1">Publique e gerencie slides, tarefas extraclasse e leituras para seus alunos.</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="h-10 bg-[#0066ff] hover:bg-[#0054d6] text-white px-4 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-[#0066ff]/10 focus:ring-2 focus:ring-[#0066ff]/20 cursor-pointer text-nowrap"
        >
          <Plus className="w-4 h-4" />
          Publicar Material
        </button>
      </div>

      {/* Select class top bar */}
      <div className="bg-white border border-[#eff4ff] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_4px_20px_rgba(0,102,255,0.01)]">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <BookOpen className="w-5 h-5 text-[#0066ff] shrink-0" />
          <div className="w-full sm:w-auto">
            <span className="text-[10px] text-[#64748b] uppercase font-bold block">Filtrar Turma Selecionada</span>
            <select
              value={selectedTurmaId}
              onChange={(e) => setSelectedTurmaId(e.target.value)}
              className="mt-1 block w-full sm:w-64 h-9 pl-2 pr-8 bg-[#f8f9ff]/50 border border-[#c2c6d8] focus:border-[#0066ff] rounded-lg text-xs font-bold outline-none cursor-pointer"
            >
              {turmas.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.scheduleDays})</option>
              ))}
            </select>
          </div>
        </div>

        {activeTurma && (
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-[#64748b] uppercase font-bold">Total Compartilhado</p>
            <p className="text-sm font-black text-[#0b1c30]">{filteredMaterials.length} itens ativos</p>
          </div>
        )}
      </div>

      {/* Materials List */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-[#dde3ec] rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#f0f6ff] text-[#0066ff] flex items-center justify-center font-bold text-2xl mx-auto">
            📂
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#0b1c30]">Nenhum material compartilhado</h3>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Você ainda não postou Slides, Atividades de Casa ou leituras de apoio para esta disciplina. Comece agora para os alunos estudarem.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex py-2 px-4 bg-[#0066ff] hover:bg-[#0054d6] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            Adicionar Primeiro Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredMaterials.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-[#eff4ff] hover:border-[#addeff] rounded-2xl p-5 shadow-[0_4px_22px_rgba(0,102,255,0.015)] transition-all flex flex-col justify-between"
            >
              <div className="space-y-3.5">
                {/* Top category badges */}
                <div className="flex justify-between items-start">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase ${
                    item.type === 'slide' 
                      ? 'bg-blue-50 text-[#0066ff] border border-blue-100'
                      : item.type === 'atividade'
                      ? 'bg-amber-50 text-amber-700 border border-amber-100'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}>
                    {item.type === 'slide' ? '💻 Slide de Aula' : item.type === 'atividade' ? '📝 Atividade e Tarefa' : '📚 Leitura complementar'}
                  </span>

                  <button
                    onClick={() => handleDeleteMaterial(item.id)}
                    className="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center cursor-pointer transition-all border border-red-100"
                    title="Excluir Material"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Core Text content */}
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-[#0b1c30] leading-tight line-clamp-1">{item.title}</h3>
                  <p className="text-[11px] text-[#64748b] leading-relaxed line-clamp-3 font-medium">{item.description}</p>
                </div>

                {/* If image link is provided */}
                {item.linkUrl && item.type === 'slide' && (
                  <div className="rounded-xl overflow-hidden aspect-video border border-slate-100 max-h-[140px] shadow-2xs select-none">
                    <img
                      src={item.linkUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>

              {/* Bottom footer bar info */}
              <div className="mt-5 pt-3.5 border-t border-[#f1f5f9] flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#64748b] gap-2">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#64748b]/80" />
                  <span>Postado em: <strong>{item.dateAdded}</strong></span>
                </div>

                {item.type === 'atividade' && (
                  <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100/60 self-start sm:self-center font-bold">
                    <span>Prazo: {item.dueDate || 'Sem prazo'}</span>
                    {item.points && (
                      <>
                        <span className="text-amber-300">•</span>
                        <span>{item.points} pts</span>
                      </>
                    )}
                  </div>
                )}

                {item.linkUrl && item.type !== 'slide' && (
                  <a
                    href={item.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-bold text-[#0066ff] hover:underline"
                  >
                    <span>Acessar Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MATERIAL POPUP MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#eff4ff] p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 border-b border-[#f1f5f9] pb-3">
              <h3 className="text-lg font-bold text-[#0b1c30]">Publicar Novo Material</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#64748b] hover:text-[#0b1c30] text-sm cursor-pointer font-bold px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMaterial} className="space-y-4">
              {/* Type Category */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Tipo de Recurso</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('slide')}
                    className={`h-10 text-xs font-extrabold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      type === 'slide'
                        ? 'bg-blue-50 text-[#0066ff] border-[#0066ff]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    💻 Slide
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('atividade')}
                    className={`h-10 text-xs font-extrabold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      type === 'atividade'
                        ? 'bg-amber-50 text-amber-700 border-amber-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    📝 Atividade
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('material')}
                    className={`h-10 text-xs font-extrabold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      type === 'material'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    📚 Leitura
                  </button>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Título do Arquivo / Tópico</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tópico 2: Matrizes e Determinantes Básicos"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-10 px-3.5 bg-white border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none font-medium"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Descrição ou Orientações</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Instruções para acesso ao material, objetivos pedagógicos ou descrição das tarefas a serem enviadas."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 bg-white border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none font-medium resize-none"
                />
              </div>

              {/* Link URL (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
                  {type === 'slide' ? 'Link de Imagem do Slide (Opcional)' : 'URL do Arquivo ou Link Externo (Opcional)'}
                </label>
                <input
                  type="url"
                  placeholder={type === 'slide' ? "https://images.unsplash.com/photo..." : "https://drive.google.com/..."}
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full h-10 px-3.5 bg-white border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none font-mono"
                />
                <p className="text-[10px] text-[#64748b] leading-tight font-medium">Assegura que os alunos possam baixar ou ver o recurso com 1 único clique.</p>
              </div>

              {/* Additional parameters for Class Atividade */}
              {type === 'atividade' && (
                <div className="grid grid-cols-2 gap-4 bg-amber-50/50 p-3.5 rounded-xl border border-amber-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-amber-900 tracking-wider">Pontuação Máxima</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Pontos (ex: 10)"
                      value={points}
                      onChange={(e) => setPoints(e.target.value)}
                      className="w-full h-9 px-2 bg-white border border-amber-200 focus:border-amber-500 rounded-lg text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-amber-900 tracking-wider">Prazo Limite de Entrega</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full h-9 px-2 bg-white border border-amber-200 focus:border-amber-500 rounded-lg text-xs font-bold outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Action and submit */}
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-10 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 bg-[#0066ff] hover:bg-[#0054d6] text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-md"
                >
                  Confirmar e Postar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
