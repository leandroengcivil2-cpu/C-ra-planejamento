import { useState, useEffect } from 'react';
import api from '../api/client';
import { ChevronRight, ChevronDown, AlertCircle, DollarSign } from 'lucide-react';

function fmtBRL(v) {
  if (!v) return 'R$ 0';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

function fmtPct(v) {
  if (v == null) return '';
  return (v * 100).toFixed(2) + '%';
}

function ItemOrcamento({ item, filhos, nivel = 0 }) {
  const [aberto, setAberto] = useState(nivel <= 1);
  const temFilhos = filhos.length > 0;

  return (
    <>
      <tr
        className={`border-b border-slate-50 ${temFilhos ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/50'}`}
        onClick={() => temFilhos && setAberto(!aberto)}
      >
        <td className="py-2 pr-2" style={{ paddingLeft: 8 + nivel * 20 }}>
          <div className="flex items-center gap-1.5">
            {temFilhos
              ? aberto ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />
              : <span className="w-3.5 shrink-0" />
            }
            <span className={`font-mono text-xs ${nivel === 0 ? 'text-slate-400' : 'text-slate-300'}`}>
              {item.codigo}
            </span>
          </div>
        </td>
        <td className={`py-2 pr-4 text-sm ${nivel === 0 ? 'font-bold text-slate-800' : nivel === 1 ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
          {item.descricao}
        </td>
        <td className="py-2 pr-3 text-xs text-slate-400 text-right">
          <span className={`px-1.5 py-0.5 rounded text-xs ${item.tipo_orcamento === 'obra' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
            {item.tipo_orcamento === 'obra' ? 'Obra' : 'AC'}
          </span>
        </td>
        <td className={`py-2 pr-3 text-right tabular-nums ${nivel <= 1 ? 'font-semibold text-slate-800' : 'text-slate-600 text-sm'}`}>
          {fmtBRL(item.total)}
        </td>
        <td className="py-2 text-right text-xs text-slate-400">
          {item.pct_total ? fmtPct(item.pct_total) : ''}
        </td>
      </tr>
      {aberto && filhos.map(filho => {
        const netos = []; // será construído recursivamente
        return <ItemOrcamento key={filho.id} item={filho} filhos={netos} nivel={nivel + 1} />;
      })}
    </>
  );
}

export default function OrcamentoPage() {
  const [dados, setDados] = useState({ itens: [], totais: {} });
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState('total');
  const [nivelMax, setNivelMax] = useState('2');

  useEffect(() => {
    setLoading(true);
    api.get(`/orcamento/itens?tipo=${tipo}&nivel_max=${nivelMax}`)
      .then(r => setDados(r.data))
      .finally(() => setLoading(false));
  }, [tipo, nivelMax]);

  const { itens, totais } = dados;

  // Monta hierarquia simples (nível 1 → 2)
  const nivelUm = itens.filter(i => i.nivel === 1);
  const nivelDois = itens.filter(i => i.nivel === 2);

  function filhosDe(item) {
    return itens.filter(i =>
      i.nivel === item.nivel + 1 &&
      i.codigo.startsWith(item.codigo + '.') &&
      i.tipo_orcamento === item.tipo_orcamento
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Controle de Orçamento</h1>
          <p className="text-slate-500 text-sm mt-0.5">Estrutura EAP com totais por grupo</p>
        </div>
      </div>

      {/* KPIs totais */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Obra', valor: totais?.obra, cor: 'blue' },
          { label: 'Áreas Comuns', valor: totais?.areas_comuns, cor: 'purple' },
          { label: 'Total Geral', valor: totais?.total, cor: 'cora' }
        ].map(({ label, valor, cor }) => (
          <div key={label} className="card flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">{label}</span>
            <span className="text-xl font-bold text-slate-800">{fmtBRL(valor)}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card flex flex-wrap gap-4">
        <div>
          <label className="label">Visão</label>
          <div className="flex gap-2">
            {[['total','Total'],['obra','Obra'],['areas_comuns','Áreas Comuns']].map(([v,l]) => (
              <button key={v} onClick={() => setTipo(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tipo === v ? 'bg-cora-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Nível de detalhamento</label>
          <select className="input w-32" value={nivelMax} onChange={e => setNivelMax(e.target.value)}>
            <option value="1">Nível 1</option>
            <option value="2">Nível 2</option>
            <option value="3">Nível 3</option>
            <option value="10">Todos</option>
          </select>
        </div>
      </div>

      {loading && <div className="card text-center py-16 text-slate-400">Carregando orçamento...</div>}

      {!loading && itens.length === 0 && (
        <div className="card text-center py-16">
          <AlertCircle size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500">Orçamento não importado ainda.</p>
          <p className="text-slate-400 text-sm mt-1">Vá em Importação e carregue o Orçamento Corá.xlsm.</p>
        </div>
      )}

      {!loading && itens.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Código</th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Descrição</th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20 text-center">Tipo</th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-40 text-right">Valor (R$)</th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {nivelUm.map(item => (
                <ItemOrcamento key={item.id} item={item} filhos={filhosDe(item)} nivel={0} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
