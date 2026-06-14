import React, { useState } from 'react';
import { Database, ShieldAlert, Code, Check, Copy, HelpCircle, Activity, Wifi, WifiOff } from 'lucide-react';
import { SUPABASE_SQL_SCHEMA, SUPABASE_CLIENT_EXAMPLE_CODE, SUPABASE_SNIPPETS } from '../lib/supabaseHelper';
import { isSupabaseConfigured, testSupabaseConnection } from '../lib/supabase';

export default function SupabaseHelperView() {
  const [activeTab, setActiveTab] = useState<'sql' | 'client' | 'snippets'>('sql');
  const [copied, setCopied] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; loading: boolean } | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTestConnection = async () => {
    setTestResult({ success: false, message: '', loading: true });
    try {
      const result = await testSupabaseConnection();
      setTestResult({
        success: result.success,
        message: result.message,
        loading: false
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Falha crítica ao testar conexão: ${err.message || err}`,
        loading: false
      });
    }
  };


  return (
    <div className="bg-white rounded-3xl border border-[#eff4ff] p-6 lg:p-8 space-y-6 shadow-[0_8px_30px_rgba(0,102,255,0.015)] relative font-sans">
      
      {/* Absolute aura decor */}
      <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-bl from-[#e1ffec] to-transparent opacity-20 pointer-events-none rounded-tr-3xl"></div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#e1ffec] text-[#006645] flex items-center justify-center">
          <Database className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-[#0b1c30]">Guia de Integração Supabase</h2>
          <p className="text-xs text-[#64748b]">Comandos SQL prontos e exemplos de código para sincronizar o banco de dados do OnClass Test.</p>
        </div>
      </div>

      {/* Core Tabs row */}
      <div className="flex bg-[#f0f6ff] p-1 rounded-xl border border-[#dce9ff] w-full max-w-sm">
        <button
          type="button"
          onClick={() => setActiveTab('sql')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'sql' ? 'bg-white text-[#0066ff] shadow-xs' : 'text-[#64748b] hover:text-[#0b1c30]'
          }`}
        >
          Esquema SQL (Copy)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('client')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'client' ? 'bg-white text-[#0066ff] shadow-xs' : 'text-[#64748b] hover:text-[#0b1c30]'
          }`}
        >
          Cliente SDK
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('snippets')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'snippets' ? 'bg-white text-[#0066ff] shadow-xs' : 'text-[#64748b] hover:text-[#0b1c30]'
          }`}
        >
          Queries
        </button>
      </div>

      {/* Visual Diagnostic Connection State Block */}
      <div className="p-5 rounded-2xl border bg-slate-50 border-[#eff4ff] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-dashed border-[#dde3ec]">
          <div className="flex items-center gap-2.5">
            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full bg-white ${isSupabaseConfigured ? 'animate-ping' : ''}`} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block">Status do Conector</span>
              <span className="text-xs font-bold text-[#0b1c30]">
                {isSupabaseConfigured 
                  ? 'Credenciais Detectadas (Supabase Prontinho)' 
                  : 'Modo Simulação Local (Credenciais Ausentes na nuvem)'}
              </span>
            </div>
          </div>

          <button
            onClick={handleTestConnection}
            disabled={testResult?.loading}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              testResult?.loading 
                ? 'bg-slate-200 text-slate-400' 
                : 'bg-[#0066ff] hover:bg-[#0054d6] text-white shadow-xs'
            }`}
          >
            {testResult?.loading ? (
              <span className="w-3.5 h-3.5 border-2 border-t-transparent border-slate-500 rounded-full animate-spin"></span>
            ) : (
              <Activity className="w-3.5 h-3.5" />
            )}
            Testar Conexão Remota
          </button>
        </div>

        {testResult && (
          <div className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
            testResult.success 
              ? 'bg-[#e1ffec] border-[#b4ffd0] text-[#006645]' 
              : 'bg-[#ffdad6] border-[#ffb4ab] text-[#ba1a1a]'
          }`}>
            {testResult.success ? <Wifi className="w-4.5 h-4.5 shrink-0" /> : <WifiOff className="w-4.5 h-4.5 shrink-0" />}
            <p className="font-semibold">{testResult.message}</p>
          </div>
        )}

        <div className="text-[11px] leading-relaxed text-[#64748b] space-y-1">
          <p>• <strong>Sem Supabase configurado?</strong> Não se preocupe! O OnClass Test funciona com fallback total em <strong>Simulação Local (localStorage)</strong> de alta fidelidade para que você possa apresentar o sistema sem ter que configurar nenhum servidor.</p>
          <p>• <strong>Para ativar conexão real:</strong> declare as credenciais <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no seu arquivo <code>.env</code> na raiz do projeto (no CodeSandbox ou no seu terminal).</p>
        </div>
      </div>

      {/* Warning message explaining standard env keys */}
      <div className="p-4 bg-[#e5eeff] border border-[#dce9ff] rounded-2xl flex items-center gap-3 text-xs text-[#0b1c30]">
        <ShieldAlert className="w-5 h-5 text-[#0066ff] shrink-0" />
        <p className="leading-relaxed">
          <strong>Segurança de chaves públicas:</strong> Ao conectar o site em produção, adicione as variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no seu arquivo <code>.env</code> ou painel de segredos do ambiente Cloud Run!
        </p>
      </div>

      {/* STEP-BY-STEP EMAIL CONFIRMATION BYPASS TUTORIAL */}
      <div className="p-5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-3 text-xs text-amber-900 leading-relaxed">
        <p className="font-extrabold flex items-center gap-2 text-amber-800 text-sm">
          <span>⚠️</span> Importante: Desmarcar/Desativar Confirmação por E-mail no Supabase
        </p>
        <p className="font-semibold text-slate-700">
          Por padrão, o Supabase exige que contas criadas verifiquem o e-mail antes de fazer login. Para desativar essa restrição e permitir login com e-mails fictícios ou de teste imediatamente, siga estes passos no seu painel Supabase:
        </p>
        <ol className="list-decimal pl-5 space-y-2 text-slate-700 font-medium">
          <li>Acesse seu <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-[#0066ff] font-extrabold hover:underline">Painel do Supabase (supabase.com)</a> e entre no seu projeto correspondente.</li>
          <li>No menu lateral esquerdo, clique no botão da engrenagem/silhueta <strong className="text-slate-900">Authentication</strong>.</li>
          <li>Entre na sub-página <strong className="text-slate-900">Providers</strong> no topo central.</li>
          <li>Clique para abrir a caixinha sanfona escrito <strong className="text-slate-900">Email</strong>.</li>
          <li>Procure o interruptor / checkbox escrito <strong className="text-red-700">"Confirm email"</strong> (ou "Enable email confirmation") e <strong className="text-red-700">DESATIVE / DESMARQUE</strong> essa opção.</li>
          <li>Role até o pé dessa seção de Email e clique no botão verde <strong className="text-emerald-700">Save (Salvar)</strong>.</li>
        </ol>
        <div className="pt-2 border-t border-amber-200/50 text-[10px] text-amber-800 font-bold">
          ✨ Prontinho! Feito isso, qualquer nova conta criada será liberada para login sem necessidade de confirmação externa.
        </div>
      </div>

      {/* ---------------- 1. TAB: ESQUEMA SQL ---------------- */}
      {activeTab === 'sql' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Tabelas Relacionais PostgreSQL</span>
            <button
              onClick={() => copyToClipboard(SUPABASE_SQL_SCHEMA, 'sql')}
              className="px-3 h-8 bg-[#0066ff] hover:bg-[#0054d6] text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs"
            >
              {copied === 'sql' ? <Check className="w-4 h-4" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === 'sql' ? 'Copiado!' : 'Copiar SQL completo'}
            </button>
          </div>

          <div className="relative">
            <pre className="p-4 bg-[#0b1c30] text-[#eaf1ff] text-xs leading-relaxed rounded-2xl h-80 overflow-y-auto font-mono scrollbar-thin">
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>
        </div>
      )}

      {/* ---------------- 2. TAB: CLIENT initialization ---------------- */}
      {activeTab === 'client' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Configuração de Conexão React / Vite</span>
            <button
              onClick={() => copyToClipboard(SUPABASE_CLIENT_EXAMPLE_CODE, 'client')}
              className="px-3 h-8 bg-[#0066ff] hover:bg-[#0054d6] text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
            >
              {copied === 'client' ? <Check className="w-4 h-4" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === 'client' ? 'Copiado!' : 'Copiar Código'}
            </button>
          </div>

          <pre className="p-4 bg-[#0b1c30] text-[#eaf1ff] text-xs leading-relaxed rounded-2xl font-mono overflow-x-auto">
            {SUPABASE_CLIENT_EXAMPLE_CODE}
          </pre>
        </div>
      )}

      {/* ---------------- 3. TAB: QUERIES SNIPPETS ---------------- */}
      {activeTab === 'snippets' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Snippet A: Get Active profile */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Buscar Perfil (Profile)</span>
                <button
                  onClick={() => copyToClipboard(SUPABASE_SNIPPETS.getProfile, 'snip-prof')}
                  className="text-xs text-[#0066ff] hover:underline"
                >
                  {copied === 'snip-prof' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="p-3 bg-[#0b1c30] text-[#eaf1ff] text-[10px] leading-relaxed rounded-xl font-mono overflow-x-auto">
                {SUPABASE_SNIPPETS.getProfile}
              </pre>
            </div>

            {/* Snippet B: Get Turmas */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Buscar Turmas</span>
                <button
                  onClick={() => copyToClipboard(SUPABASE_SNIPPETS.getTurmas, 'snip-turm')}
                  className="text-xs text-[#0066ff] hover:underline"
                >
                  {copied === 'snip-turm' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="p-3 bg-[#0b1c30] text-[#eaf1ff] text-[10px] leading-relaxed rounded-xl font-mono overflow-x-auto">
                {SUPABASE_SNIPPETS.getTurmas}
              </pre>
            </div>

            {/* Snippet C: Realtime Feed listener */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Feed Realtime (Postgres insertion listener)</span>
                <button
                  onClick={() => copyToClipboard(SUPABASE_SNIPPETS.realtimePresenceFeed, 'snip-rt')}
                  className="text-xs text-[#0066ff] hover:underline"
                >
                  {copied === 'snip-rt' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="p-3 bg-[#0b1c30] text-[#eaf1ff] text-[10px] leading-relaxed rounded-xl font-mono overflow-x-auto">
                {SUPABASE_SNIPPETS.realtimePresenceFeed}
              </pre>
            </div>

            {/* Snippet D: Record Attendance */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Registrar Presença Aluno</span>
                <button
                  onClick={() => copyToClipboard(SUPABASE_SNIPPETS.recordStudentPresence, 'snip-rec')}
                  className="text-xs text-[#0066ff] hover:underline"
                >
                  {copied === 'snip-rec' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="p-3 bg-[#0b1c30] text-[#eaf1ff] text-[10px] leading-relaxed rounded-xl font-mono overflow-x-auto">
                {SUPABASE_SNIPPETS.recordStudentPresence}
              </pre>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
