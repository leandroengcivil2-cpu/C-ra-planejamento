import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../api/client';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtPct(v) {
  if (v == null) return '—';
  return (v * 100).toFixed(2) + '%';
}

function fmtBRL(v) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

function SemaforoChip({ idp }) {
  if (idp == null) return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-slate-100 text-slate-600">Sem dados</span>;
  const cor = idp >= 1 ? 'emerald' : idp >= 0.85 ? 'amber' : 'red';
  const texto = idp >= 1 ? 'No prazo' : idp >= 0.85 ? 'Atenção' : 'Atrasado';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-${cor}-100 text-${cor}-800`}>
      <span className={`w-2 h-2 rounded-full bg-${cor}-500`} />
      {texto} (IDP {idp.toFixed(3)})
    </span>
  );
}

function KpiCard({ titulo, valor, sub, icone: Icone, cor = 'slate' }) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <span className="text-sm text-slate-500 font-medium">{titulo}</span>
        {Icone && <Icone size={18} className={`text-${cor}-500`} />}
      </div>
      <div className="text-2xl font-bold text-slate-800">{valor}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [dados, setDados] = useState(null);
  const [visao, setVisao] = useState('total');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/dashboard?visao=${visao}`)
      .then(r => setDados(r.data))
      .catch(e => setErro(e.response?.data?.error || 'Erro ao carregar dashboard'))
      .finally(() => setLoading(false));
  }, [visao]);

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">Carregando...</div>
  );

  if (erro) return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-2">
        <AlertCircle size={18} /> {erro}
      </div>
    </div>
  );

  if (dados?.sem_dados) return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard Físico-Financeiro</h1>
      <div className="card text-center py-16">
        <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500 font-medium">Nenhum cronograma importado</p>
        <p className="text-slate-400 text-sm mt-1">Vá em Importação e carregue o arquivo Cronograma Corá.xlsm</p>
      </div>
    </div>
  );

  const curvaS = (dados?.curva_s || []).map(p => ({
    ...p,
    mes_label: (() => {
      const [ano, mes] = p.mes.split('-');
      return `${MESES_PT[parseInt(mes) - 1]}/${ano.slice(2)}`;
    })(),
    pct_prev_pct: +(p.pct_prevista_acum * 100).toFixed(2),
    pct_real_pct: +(p.pct_concluida_acum * 100).toFixed(2),
    cp_mi: +(p.cp_acum / 1e6).toFixed(2),
    va_mi: +(p.va_acum / 1e6).toFixed(2)
  }));

  const vpPositivo = (dados?.vp || 0) >= 0;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Físico-Financeiro</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Cronograma: <span className="font-medium">{dados?.versao?.nome}</span>
            {dados?.versao?.data_importacao && ` — importado em ${new Date(dados.versao.data_importacao).toLocaleDateString('pt-BR')}`}
          </p>
        </div>
        {/* Seletor de visão */}
        <div className="flex gap-2">
          {[['total','Total'],['obra','Obra'],['areas_comuns','Áreas Comuns']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setVisao(v)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                visao === v ? 'bg-cora-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-cora-400'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Semáforo */}
      <div className="flex items-center gap-3">
        <SemaforoChip idp={dados?.idp} />
        <span className="text-slate-400 text-sm">|</span>
        <span className="text-sm text-slate-500">
          Orçamento de referência: <span className="font-semibold text-slate-700">{fmtBRL(dados?.orcamento)}</span>
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          titulo="% Física Prevista"
          valor={fmtPct(dados?.pct_prevista)}
          sub="Acumulado até a data de referência"
          icone={Minus}
          cor="slate"
        />
        <KpiCard
          titulo="% Física Realizada"
          valor={fmtPct(dados?.pct_concluida)}
          sub="Medição de campo acumulada"
          icone={dados?.pct_concluida >= dados?.pct_prevista ? TrendingUp : TrendingDown}
          cor={dados?.pct_concluida >= dados?.pct_prevista ? 'emerald' : 'red'}
        />
        <KpiCard
          titulo="Custo Planejado (CP)"
          valor={fmtBRL(dados?.cp)}
          sub={`${fmtPct(dados?.pct_prevista)} × orçamento`}
          icone={Minus}
          cor="slate"
        />
        <KpiCard
          titulo="Valor Agregado (VA)"
          valor={fmtBRL(dados?.va)}
          sub={`${fmtPct(dados?.pct_concluida)} × orçamento`}
          icone={dados?.va >= dados?.cp ? TrendingUp : TrendingDown}
          cor={dados?.va >= dados?.cp ? 'emerald' : 'amber'}
        />
      </div>

      {/* VP */}
      {dados?.vp != null && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          vpPositivo ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
        }`}>
          {vpPositivo ? <TrendingUp className="text-emerald-600" size={20} /> : <TrendingDown className="text-amber-600" size={20} />}
          <div>
            <span className="font-semibold text-slate-700">Variação de Prazo (VP): </span>
            <span className={`font-bold ${vpPositivo ? 'text-emerald-700' : 'text-amber-700'}`}>
              {vpPositivo ? '+' : ''}{fmtBRL(dados.vp)}
            </span>
            <span className="text-slate-500 text-sm ml-2">
              {vpPositivo ? '— obra adiantada em relação ao planejamento' : '— obra atrasada em relação ao planejamento'}
            </span>
          </div>
        </div>
      )}

      {/* Curva S */}
      {curvaS.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Curva S — Avanço Físico-Financeiro</h2>
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={curvaS} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gradPrev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b5fc0" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b5fc0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes_label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="pct" tickFormatter={v => v + '%'} tick={{ fontSize: 11 }} width={42} />
              <YAxis yAxisId="fin" orientation="right" tickFormatter={v => `R$${v}M`} tick={{ fontSize: 11 }} width={52} />
              <Tooltip
                formatter={(v, name) => {
                  if (name.includes('%')) return [v + '%', name];
                  return [`R$ ${v}M`, name];
                }}
              />
              <Legend />
              <Area yAxisId="pct" type="monotone" dataKey="pct_prev_pct" name="% Prevista" stroke="#3b5fc0" fill="url(#gradPrev)" strokeWidth={2} dot={false} />
              <Area yAxisId="pct" type="monotone" dataKey="pct_real_pct" name="% Realizada" stroke="#10b981" fill="url(#gradReal)" strokeWidth={2} dot={false} />
              <Area yAxisId="fin" type="monotone" dataKey="cp_mi" name="CP (R$M)" stroke="#94a3b8" fill="none" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
              <Area yAxisId="fin" type="monotone" dataKey="va_mi" name="VA (R$M)" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-400 mt-2">
            Nota: IDC e EAC não disponíveis nesta versão — aguardando normalização dos dados de Custo Real (MEGA/Paggo).
          </p>
        </div>
      )}
    </div>
  );
}
