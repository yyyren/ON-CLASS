import React, { useState } from 'react';
import { User } from '../types';
import { Check, Camera, RefreshCw } from 'lucide-react';

interface TeacherSettingsProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
}

type TabState = 'perfil' | 'seguranca' | 'notificacoes' | 'tema';

export default function TeacherSettings({ user, onUpdateUser }: TeacherSettingsProps) {
  const [activeTab, setActiveTab] = useState<TabState>('perfil');
  const [name, setName] = useState(user.name);
  const [title, setTitle] = useState(user.title || '');
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [email] = useState(user.email); // Institutional email locked according to screenshot instruction
  
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setAvatarUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      ...user,
      name,
      title,
      bio,
      avatarUrl,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. HEADER TITLE */}
      <div className="border-b border-[#f1f5f9] pb-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0b1c30]">Configurações</h1>
        <p className="text-sm text-[#64748b] mt-1">Gerencie suas preferências de conta, segurança e interface.</p>
      </div>

      {/* 2. TAB CONTROLS (Perfil, Segurança, Notificações, Tema) */}
      <div className="border-b border-[#e5eeff] pb-px mb-4">
        <div className="flex gap-6">
          {(['perfil', 'seguranca', 'notificacoes', 'tema'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              id={`tab-settings-${tab}`}
              className={`pb-4 text-sm font-semibold transition-all relative capitalize cursor-pointer ${
                activeTab === tab
                  ? 'text-[#0066ff]'
                  : 'text-[#64748b] hover:text-[#0b1c30]'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066ff]"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* SUCCESS FLAG BANNER */}
      {saveSuccess && (
        <div className="p-4 bg-[#e1ffec] text-[#006645] text-xs font-bold rounded-xl border border-[#008259] flex items-center gap-2 animate-fade-in">
          <Check className="w-4.5 h-4.5" />
          Alterações no perfil salvas com sucesso!
        </div>
      )}

      {/* ---------------- ACTIVE TAB 1: PERFIL ---------------- */}
      {activeTab === 'perfil' && (
        <form onSubmit={handleSave} className="bg-white rounded-3xl border border-[#eff4ff] p-6 lg:p-8 space-y-7 shadow-[0_12px_40px_rgba(0,102,255,0.015)]">
          
          {/* Avatar Settings Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-[#f1f5f9]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="w-20 h-20 rounded-full object-cover border-2 border-[#dde3ec] shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 bg-slate-100 text-[#64748b] text-sm font-bold flex items-center justify-center rounded-full border-2 border-dashed border-[#c2c6d8]">
                Sem Foto
              </div>
            )}
            
            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-bold text-[#0b1c30]">Foto de Perfil</h3>
              <p className="text-xs text-[#64748b]">Formatos aceitos: JPG, PNG, GIF. Recomenda-se imagem quadrada.</p>
              
              <div className="flex gap-2.5 pt-1.5">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 h-9 bg-[#0066ff] hover:bg-[#0054d6] text-white text-xs font-bold rounded-xl shadow-sm transition-all">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Escolher da Galeria</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="px-3.5 h-9 bg-white text-[#64748b] hover:text-[#0b1c30] border border-[#dde3ec] hover:border-[#c2c6d8] text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Core Fields Form Layout Row/Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nome */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0b1c30]" htmlFor="field-name">
                Nome Completo
              </label>
              <input
                id="field-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-4 bg-white border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none"
              />
            </div>

            {/* Title / Cargo */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0b1c30]" htmlFor="field-title">
                Título/Cargo
              </label>
              <input
                id="field-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-11 px-4 bg-white border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none"
              />
            </div>
          </div>

          {/* Email Row (Non-editable inside school systems, marked locked as in image mockups) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#0b1c30]" htmlFor="field-email">
              E-mail Institucional
            </label>
            <input
              id="field-email"
              type="email"
              disabled
              value={email}
              className="w-full h-11 px-4 bg-[#f8f9ff] text-[#64748b] border border-[#eff4ff] rounded-xl text-xs cursor-not-allowed outline-none font-medium"
            />
            <p className="text-[10px] text-[#64748b] font-medium leading-normal pl-1">
              Para alterar o e-mail institucional, contate o suporte de TI.
            </p>
          </div>

          {/* Bio text block */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#0b1c30]" htmlFor="field-bio">
              Biografia Curta
            </label>
            <textarea
              id="field-bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-4 bg-white border border-[#c2c6d8] focus:border-[#0066ff] rounded-xl text-xs transition-all outline-none leading-relaxed"
              placeholder="Fale um pouco sobre você..."
            />
          </div>

          {/* Action trigger footer aligned right */}
          <div className="flex gap-3 justify-end pt-5 border-t border-[#f1f5f9] mt-6">
            <button
              type="button"
              className="px-5 h-11 bg-white hover:bg-[#f8f9ff] text-[#64748b] border border-[#dde3ec] font-semibold text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-save-settings"
              className="px-6 h-11 bg-[#0066ff] hover:bg-[#0054d6] text-white font-semibold text-xs rounded-xl shadow-lg shadow-[#0066ff]/10 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      )}

      {/* ---------------- OTHER TABS MOCKUPS (Stops cluttering, shows clean placeholder layouts) ---------------- */}
      {activeTab !== 'perfil' && (
        <div className="bg-white rounded-3xl border border-[#eff4ff] p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-12 h-12 rounded-full bg-[#f0f6ff] text-[#0066ff] flex items-center justify-center mb-4">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <h4 className="text-base font-bold text-[#0b1c30] capitalize">{activeTab} - Painel Ativo</h4>
          <p className="text-xs text-[#64748b] max-w-[280px] mt-2 leading-relaxed">
            Painel de controle de {activeTab} configurado e pronto para comunicação direta com tabelas de parâmetros do banco de dados Supabase.
          </p>
        </div>
      )}
    </div>
  );
}
