import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Plus, X, Pencil, Trash2, AlertTriangle, FileSignature } from 'lucide-react';

// ── Configuração de status ───────────────────────────────────────────────────
const STATUS = {
  a_contratar:   { label: 'A contratar',   cor: 'bg-slate-100 text-slate-700 border-slate-200' },
  em_cotacao:    { label: 'Em cotação',    cor: 'bg-blue-50 text-blue-700 border-blue-200' },
  em_negociacao: { label: 'Em negociação', cor: 'bg-amber-50 text-amber-700 border-amber-200' },
  contratado:    { label: 'Contratado',    cor: 'bg-green-50 text-green-700 border-green-200' }
};
const STATUS_ORDEM = ['a_contratar', 'em_cotacao', 'em_negociacao', 'contratado'];

function fmtBRL(v) {
  if (v == null || isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
function fmtDataBR(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function diasAte(iso) {
  if (!iso) return null;
  const alvo = new Date(iso + 'T00:00:00');
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo - hoje) / (1000 * 60 * 60 * 24));
}

// ── Modal de cadastro/edição ─────────────────────────────────────────────────
function ModalContratacao({ registro, gruposEap, onFechar, onSalvo }) {
  const vazio = {
    descricao: '', codigo_eap: '', status: 'a_contratar',
    responsavel: '', data_limite: '', fornecedor: '', valor_contratado: '', observacao: ''
  };
  const [form, setForm] = useState(registro
    ? {
        descricao: registro.descricao || '',
        codigo_eap: registro.codigo_eap || '',
        status: registro.status || 'a_contratar',
        responsavel: registro.responsavel || '',
        data_limite: registro.data_limite || '',
        fornecedor: registro.fornecedor || '',
        valor_contratado: registro.valor_contratado ?? '',
        observacao: registro.observacao || ''
      }
    : vazio);
  const [salvando, setSalvando] = useState(false);

  function set(campo, valor) { setForm(f => ({ ...f, [campo]: valor })); }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    const grupo = gruposEap.find(g => g.codigo === form.codigo_eap);
    const payload = {
      descricao: form.descricao,
      codigo_eap: form.codigo_eap || null,
      descricao_eap: grupo ? grupo.descricao : null,
      tipo_orcamento: grupo ? grupo.tipo_orcamento : null,
      valor_orcado: grupo ? grupo.valor_orcado : 0,
      status: form.status,
      responsavel: form.responsavel || null,
      data_limite: form.data_limite || null,
      fornecedor: form.fornecedor || null,
      valor_contratado: form.valor_contratado === '' ? null : parseFloat(form.valor_contratado),
      observacao: form.observacao || null
    };
    try {
      if (registro) await api.put(`/contratacoes/${registro.id}`, payload);
      else await api.post('/contratacoes', payload);
      onSalvo();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  const ehContratado = form.status === 'contratado';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="font-bold text-slate-800">
            {registro ? 'Editar contratação' : 'Nova contratação'}
          </h2>
          <button onClick={onFechar}><X size={20} className="text-slate-400" /></button>
        </div>

        <form onSubmit={salvar} className="p-6 space-y-4">
          <div>
            <label className="label">Serviço / pacote a contratar *</label>
            <input className="input" value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
              placeholder="Ex: Estrutura de concreto, Esquadrias de alumínio..." required />
          </div>

          <div>
            <label className="label">Grupo do orçamento (EAP)</label>
            <select className="input" value={form.codigo_eap}
              onChange={e => set('codigo_eap', e.target.value)}>
              <option value="">Sem vínculo</option>
              {gruposEap.map(g => (
                <option key={`${g.tipo_orcamento}-${g.codigo}`} value={g.codigo}>
                  {g.codigo} — {g.descricao} ({fmtBRL(g.valor_orcado)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status}
                onChange={e => set('status', e.target.value)}>
                {STATUS_ORDEM.map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Data-limite p/ contratar</label>
              <input type="date" className="input" value={form.data_limite}
                onChange={e => set('data_limite', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Responsável</label>
            <input className="input" value={form.responsavel}
              onChange={e => set('responsavel', e.target.value)}
              placeholder="Quem conduz a contratação" />
          </div>

          {ehContratado && (
            <div className="grid grid-cols-2 gap-4 bg-green-50/60 border border-green-100 rounded-lg p-3">
              <div>
                <label className="label">Fornecedor</label>
                <input className="input" value={form.fornecedor}
                  onChange={e => set('fornecedor', e.target.value)} />
              </div>
              <div>
                <label className="label">Valor contratado (R$)</label>
                <input type="number" step="0.01" min="0" className="input" value={form.valor_contratado}
                  onChange={e => set('valor_contratado', e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label className="label">Observação</label>
            <textarea className="input resize-none" rows={2} value={form.observacao}
              onChange={e => set('observacao', e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onFechar} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-primary">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function Kpi({ titulo, valor, sub, cor = 'text-slate-800' }) {
  return (
    <div className="card">
      <div className="text-xs font-medium text-slate-500">{titulo}</div>
      <div className={`text-2xl font-bold mt-1 ${cor}`}>{valor}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function ContratacaoPage() {
  const { user } = useAuth();
  const podeEditar = ['gestor', 'admin'].includes(user?.perfil);

  const [itens, setItens] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [gruposEap, setGruposEap] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);

  function carregar() {
    setLoading(true);
    const url = filtro ? `/contratacoes?status=${filtro}` : '/contratacoes';
    api.get(url)
      .then(r => { setItens(r.data.itens || []); setResumo(r.data.resumo || null); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { carregar(); }, [filtro]);
  useEffect(() => { api.get('/contratacoes/eap').then(r => setGruposEap(r.data || [])); }, []);

  async function excluir(id) {
    if (!confirm('Excluir esta contratação?')) return;
    await api.delete(`/contratacoes/${id}`);
    carregar();
  }

  function abrirNova() { setEditando(null); setModal(true); }
  function abrirEdicao(reg) { setEditando(reg); setModal(true); }
  function aoSalvar() { setModal(false); setEditando(null); carregar(); }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileSignature size={24} className="text-cora-600" /> Contratações
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Mapa de contratações vinculado ao orçamento
          </p>
        </div>
        {podeEditar && (
          <button onClick={abrirNova} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nova contratação
          </button>
        )}
      </div>

      {/* KPIs */}
      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi titulo="A contratar" valor={resumo.por_status.a_contratar}
            sub={`${fmtBRL(resumo.valor_pendente)} orçado pendente`} />
          <Kpi titulo="Em andamento"
            valor={resumo.por_status.em_cotacao + resumo.por_status.em_negociacao}
            sub={`${resumo.por_status.em_cotacao} cotação · ${resumo.por_status.em_negociacao} negociação`} />
          <Kpi titulo="Contratado" valor={resumo.por_status.contratado}
            sub={fmtBRL(resumo.valor_contratado_total)} cor="text-green-700" />
          <Kpi titulo="Economia acumulada" valor={fmtBRL(resumo.economia_total)}
            sub="orçado − contratado"
            cor={resumo.economia_total >= 0 ? 'text-green-700' : 'text-red-600'} />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFiltro('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${filtro === '' ? 'bg-cora-600 text-white border-cora-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
          Todos
        </button>
        {STATUS_ORDEM.map(s => (
          <button key={s} onClick={() => setFiltro(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${filtro === s ? 'bg-cora-600 text-white border-cora-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {STATUS[s].label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {loading && <div className="card text-center py-16 text-slate-400">Carregando...</div>}

      {!loading && itens.length === 0 && (
        <div className="card text-center py-16">
          <p className="text-slate-500">Nenhuma contratação cadastrada.</p>
          {podeEditar && (
            <button onClick={abrirNova} className="btn-primary mt-3 inline-flex items-center gap-2">
              <Plus size={16} /> Cadastrar a primeira
            </button>
          )}
        </div>
      )}

      {!loading && itens.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500 border-b border-slate-200">
                <th className="px-4 py-3">Serviço / Pacote</th>
                <th className="px-4 py-3">Grupo EAP</th>
                <th className="px-4 py-3 text-right">Orçado</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Data-limite</th>
                <th className="px-4 py-3 text-right">Contratado</th>
                <th className="px-4 py-3 text-right">Economia</th>
                {podeEditar && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {itens.map(c => {
                const dias = diasAte(c.data_limite);
                const alerta = c.status !== 'contratado' && dias != null && dias <= 15;
                return (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.descricao}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {c.codigo_eap ? `${c.codigo_eap} — ${c.descricao_eap || ''}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmtBRL(c.valor_orcado)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS[c.status]?.cor}`}>
                        {STATUS[c.status]?.label || c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.responsavel || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={alerta ? 'text-red-600 font-medium inline-flex items-center gap-1' : 'text-slate-600'}>
                        {alerta && <AlertTriangle size={13} />}
                        {fmtDataBR(c.data_limite)}
                        {alerta && dias >= 0 && <span className="text-xs">({dias}d)</span>}
                        {alerta && dias < 0 && <span className="text-xs">(vencida)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {c.status === 'contratado' ? fmtBRL(c.valor_contratado) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {c.economia == null ? '—' : (
                        <span className={c.economia >= 0 ? 'text-green-700' : 'text-red-600'}>
                          {fmtBRL(c.economia)}
                        </span>
                      )}
                    </td>
                    {podeEditar && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => abrirEdicao(c)} className="text-slate-400 hover:text-cora-600" title="Editar">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => excluir(c.id)} className="text-slate-400 hover:text-red-600" title="Excluir">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ModalContratacao
          registro={editando}
          gruposEap={gruposEap}
          onFechar={() => { setModal(false); setEditando(null); }}
          onSalvo={aoSalvar}
        />
      )}
    </div>
  );
}
