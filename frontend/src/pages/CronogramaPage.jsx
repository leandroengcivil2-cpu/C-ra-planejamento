import { useState, useEffect } from 'react';
import api from '../api/client';
import { ChevronRight, ChevronDown, AlertCircle } from 'lucide-react';

function fmtData(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtPct(v) {
  if (v == null) return '—';
  return (v * 100).toFixed(1) + '%';
}

function StatusBadge({ desvio }) {
  if (desvio == null) return null;
  if (desvio > 5) return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">Atrasado</span>;
  if (desvio > 0) return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Atenção</span>;
  if (desvio < 0) return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Adiantado</span>;
  return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">No prazo</span>;
}

function BarraProgresso({ pct, cor = 'cora' }) {
  const pctNum = Math.min((pct || 0) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${cor === 'cora' ? 'bg-cora-500' : 'bg-emerald-500'}`}
          style={{ width: pctNum + '%' }}
        />
      </div>
      <span className="text-xs text-slate-500 w-10">{pctNum.toFixed(0)}%</span>
    </div>
  );
}

function LinhaTarefa({ tarefa, nivel }) {
  const [aberta, setAberta] = useState(nivel <= 2);
  const temFilhos = false; // simplificado — todas as tarefas são folhas no Gantt plano

  const indent = nivel * 16;

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
      <td className="py-1.5 pr-2 text-xs text-slate-400 font-mono whitespace-nowrap">{tarefa.edt}</td>
      <td className="py-1.5 pr-3 text-sm" style={{ paddingLeft: indent + 8 }}>
        <span className={tarefa.critica ? 'text-red-700 font-medium' : 'text-slate-700'}>
          {tarefa.nome}
        </span>
        {tarefa.critica === 1 && <span className="ml-1 text-red-400 text-xs">★</span>}
      </td>
      <td className="py-1.5 pr-3 text-xs text-slate-400 whitespace-nowrap">{tarefa.pavimento || '—'}</td>
      <td className="py-1.5 pr-3 text-xs text-slate-400 whitespace-nowrap">{fmtData(tarefa.inicio_lb)}</td>
      <td className="py-1.5 pr-3 text-xs text-slate-400 whitespace-nowrap">{fmtData(tarefa.termino_lb)}</td>
      <td className="py-1.5 pr-3 text-xs text-slate-400 whitespace-nowrap">{fmtData(tarefa.inicio)}</td>
      <td className="py-1.5 pr-3 text-xs text-slate-400 whitespace-nowrap">{fmtData(tarefa.termino)}</td>
      <td className="py-1.5 pr-3"><BarraProgresso pct={tarefa.pct_prevista} cor="slate" /></td>
      <td className="py-1.5 pr-3"><BarraProgresso pct={tarefa.pct_concluida} cor="cora" /></td>
      <td className="py-1.5">
        {tarefa.pacote === 'ATIVIDADE' && <StatusBadge desvio={tarefa.desvio_dias} />}
      </td>
    </tr>
  );
}

export default function CronogramaPage() {
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ critica: '', pavimento: '', nivel_max: '3' });

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtros.critica) params.set('critica', filtros.critica);
    if (filtros.pavimento) params.set('pavimento', filtros.pavimento);
    if (filtros.nivel_max) params.set('nivel_max', filtros.nivel_max);
    params.set('pacote', 'ATIVIDADE');

    api.get(`/cronograma/tarefas?${params}`)
      .then(r => setTarefas(r.data))
      .finally(() => setLoading(false));
  }, [filtros]);

  const pavimentosUnicos = [...new Set(tarefas.map(t => t.pavimento).filter(Boolean))].sort();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cronograma</h1>
          <p className="text-slate-500 text-sm mt-0.5">{tarefas.length} atividades</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card flex flex-wrap gap-4">
        <div>
          <label className="label">Caminho crítico</label>
          <select className="input w-40" value={filtros.critica}
            onChange={e => setFiltros(f => ({ ...f, critica: e.target.value }))}>
            <option value="">Todas</option>
            <option value="true">Somente críticas</option>
            <option value="false">Não críticas</option>
          </select>
        </div>
        <div>
          <label className="label">Pavimento</label>
          <select className="input w-48" value={filtros.pavimento}
            onChange={e => setFiltros(f => ({ ...f, pavimento: e.target.value }))}>
            <option value="">Todos</option>
            {pavimentosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Profundidade EDT</label>
          <select className="input w-32" value={filtros.nivel_max}
            onChange={e => setFiltros(f => ({ ...f, nivel_max: e.target.value }))}>
            <option value="2">Nível 2</option>
            <option value="3">Nível 3</option>
            <option value="4">Nível 4</option>
            <option value="10">Todos</option>
          </select>
        </div>
      </div>

      {loading && <div className="card text-center py-16 text-slate-400">Carregando tarefas...</div>}

      {!loading && tarefas.length === 0 && (
        <div className="card text-center py-16">
          <AlertCircle size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500">Nenhuma tarefa encontrada.</p>
          <p className="text-slate-400 text-sm mt-1">Importe o Cronograma Corá.xlsm primeiro.</p>
        </div>
      )}

      {!loading && tarefas.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">EDT</th>
                  <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
                  <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Pavimento</th>
                  <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Início LB</th>
                  <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Término LB</th>
                  <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Início Real</th>
                  <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Término Real</th>
                  <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">% Prevista</th>
                  <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">% Realizada</th>
                  <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {tarefas.map(t => (
                  <LinhaTarefa key={t.id} tarefa={t} nivel={t.nivel} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
