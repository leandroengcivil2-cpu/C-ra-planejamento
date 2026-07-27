import { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import {
  Package, Plus, X, ArrowDownToLine, ClipboardList, ClipboardCheck,
  AlertTriangle, Boxes, Trash2
} from 'lucide-react';

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const hoje = () => new Date().toISOString().slice(0, 10);

export default function AlmoxarifadoPage() {
  const { user } = useAuth();
  const podeEditar = ['gestor', 'admin', 'almoxarife'].includes(user?.perfil);
  const podePlanejar = ['gestor', 'admin', 'engenheiro'].includes(user?.perfil);

  const [aba, setAba] = useState('insumos');
  const [insumos, setInsumos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [lb, setLb] = useState({ atividades: [], pavimentos: [] });

  function carregarInsumos() {
    api.get('/almoxarifado/insumos').then(r => setInsumos(r.data));
    api.get('/almoxarifado/alertas').then(r => setAlertas(r.data));
  }
  useEffect(() => {
    carregarInsumos();
    api.get('/lb/segmentos').then(r => setLb({ atividades: r.data.atividades || [], pavimentos: r.data.pavimentos || [] }));
  }, []);

  const abas = [
    { id: 'insumos', label: 'Insumos & Estoque', icon: Boxes },
    { id: 'plano', label: 'Consumo Previsto', icon: ClipboardList },
    { id: 'retiradas', label: 'Fichas de Retirada', icon: ArrowDownToLine },
    { id: 'apropriacao', label: 'Apropriação', icon: ClipboardCheck }
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Package size={24} className="text-cora-600" /> Almoxarifado
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Controle de insumos, retiradas e apropriação por pavimento/atividade</p>
      </div>

      {alertas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle size={16} /> <strong>{alertas.length}</strong> insumo(s) abaixo do estoque mínimo:
          <span className="text-amber-700">{alertas.slice(0, 4).map(a => a.descricao).join(', ')}{alertas.length > 4 ? '…' : ''}</span>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${aba === a.id ? 'border-cora-600 text-cora-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <a.icon size={16} /> {a.label}
          </button>
        ))}
      </div>

      {aba === 'insumos' && <TabInsumos insumos={insumos} podeEditar={podeEditar} onChange={carregarInsumos} />}
      {aba === 'plano' && <TabPlano insumos={insumos} atividades={lb.atividades} podePlanejar={podePlanejar} />}
      {aba === 'retiradas' && <TabRetiradas insumos={insumos} lb={lb} podeEditar={podeEditar} onChange={carregarInsumos} />}
      {aba === 'apropriacao' && <TabApropriacao atividades={lb.atividades} pavimentos={lb.pavimentos} />}
    </div>
  );
}

// ── Aba Insumos ──────────────────────────────────────────────────────────────

function TabInsumos({ insumos, podeEditar, onChange }) {
  const [modal, setModal] = useState(null); // 'novo' | insumo (editar)
  const [entrada, setEntrada] = useState(null); // insumo p/ dar entrada

  return (
    <div className="space-y-4">
      {podeEditar && (
        <button onClick={() => setModal('novo')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Novo insumo
        </button>
      )}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
            <tr>
              <th className="py-2.5 px-4">Descrição</th>
              <th className="py-2.5 px-3">Un.</th>
              <th className="py-2.5 px-3">Categoria</th>
              <th className="py-2.5 px-3 text-right">Estoque</th>
              <th className="py-2.5 px-3 text-right">Mínimo</th>
              {podeEditar && <th className="py-2.5 px-3 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {insumos.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">Nenhum insumo cadastrado.</td></tr>
            )}
            {insumos.map(i => {
              const baixo = i.estoque_minimo > 0 && i.estoque_atual < i.estoque_minimo;
              return (
                <tr key={i.id} className="border-b border-slate-50">
                  <td className="py-2 px-4 font-medium text-slate-700">
                    {i.codigo && <span className="text-slate-400 mr-1">{i.codigo}</span>}{i.descricao}
                  </td>
                  <td className="py-2 px-3 text-slate-500">{i.unidade}</td>
                  <td className="py-2 px-3 text-slate-500">{i.categoria || '—'}</td>
                  <td className={`py-2 px-3 text-right font-semibold ${baixo ? 'text-red-600' : 'text-slate-700'}`}>
                    {fmt(i.estoque_atual)}{baixo && <AlertTriangle size={13} className="inline ml-1 -mt-0.5" />}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-400">{fmt(i.estoque_minimo)}</td>
                  {podeEditar && (
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button onClick={() => setEntrada(i)} className="text-xs text-emerald-700 border border-emerald-200 rounded px-2 py-1 hover:bg-emerald-50 mr-1">+ Entrada</button>
                      <button onClick={() => setModal(i)} className="text-xs text-slate-500 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50">Editar</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && <ModalInsumo insumo={modal === 'novo' ? null : modal} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); onChange(); }} />}
      {entrada && <ModalEntrada insumo={entrada} onFechar={() => setEntrada(null)} onSalvo={() => { setEntrada(null); onChange(); }} />}
    </div>
  );
}

function ModalInsumo({ insumo, onFechar, onSalvo }) {
  const [f, setF] = useState(insumo || { codigo: '', descricao: '', unidade: '', categoria: '', estoque_minimo: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function salvar(e) {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      if (insumo) await api.put(`/almoxarifado/insumos/${insumo.id}`, f);
      else await api.post('/almoxarifado/insumos', f);
      onSalvo();
    } catch (err) { setErro(err.response?.data?.error || 'Erro'); } finally { setSalvando(false); }
  }
  return (
    <Modal titulo={insumo ? 'Editar insumo' : 'Novo insumo'} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Código</label><input className="input" value={f.codigo || ''} onChange={e => setF({ ...f, codigo: e.target.value })} /></div>
          <div className="col-span-2"><label className="label">Unidade *</label><input className="input" placeholder="saco, m³, kg, un..." value={f.unidade || ''} onChange={e => setF({ ...f, unidade: e.target.value })} required /></div>
        </div>
        <div><label className="label">Descrição *</label><input className="input" value={f.descricao || ''} onChange={e => setF({ ...f, descricao: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Categoria</label><input className="input" value={f.categoria || ''} onChange={e => setF({ ...f, categoria: e.target.value })} /></div>
          <div><label className="label">Estoque mínimo</label><input type="number" step="any" min="0" className="input" value={f.estoque_minimo ?? ''} onChange={e => setF({ ...f, estoque_minimo: e.target.value })} /></div>
        </div>
        {erro && <div className="text-sm text-red-600">{erro}</div>}
        <div className="flex justify-end gap-3"><button type="button" onClick={onFechar} className="btn-secondary">Cancelar</button><button disabled={salvando} className="btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button></div>
      </form>
    </Modal>
  );
}

function ModalEntrada({ insumo, onFechar, onSalvo }) {
  const [qtd, setQtd] = useState(''); const [motivo, setMotivo] = useState(''); const [salvando, setSalvando] = useState(false);
  async function salvar(e) {
    e.preventDefault(); setSalvando(true);
    try {
      await api.post(`/almoxarifado/insumos/${insumo.id}/movimento`, { tipo: 'entrada', quantidade: qtd, motivo, data: hoje() });
      onSalvo();
    } catch (err) { alert(err.response?.data?.error || 'Erro'); } finally { setSalvando(false); }
  }
  return (
    <Modal titulo={`Entrada de estoque — ${insumo.descricao}`} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div><label className="label">Quantidade ({insumo.unidade}) *</label><input type="number" step="any" min="0" className="input" value={qtd} onChange={e => setQtd(e.target.value)} required autoFocus /></div>
        <div><label className="label">Motivo / NF</label><input className="input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: Compra NF 1234" /></div>
        <div className="flex justify-end gap-3"><button type="button" onClick={onFechar} className="btn-secondary">Cancelar</button><button disabled={salvando} className="btn-primary">{salvando ? 'Salvando...' : 'Registrar entrada'}</button></div>
      </form>
    </Modal>
  );
}

// ── Aba Consumo Previsto ─────────────────────────────────────────────────────

function TabPlano({ insumos, atividades, podePlanejar }) {
  const [atividade, setAtividade] = useState('');
  const [plano, setPlano] = useState([]);
  const [novo, setNovo] = useState({ insumo_id: '', qtd_por_pavimento: '' });

  function carregar(a) {
    if (!a) { setPlano([]); return; }
    api.get(`/almoxarifado/plano?atividade=${encodeURIComponent(a)}`).then(r => setPlano(r.data));
  }
  useEffect(() => { carregar(atividade); }, [atividade]);

  async function adicionar(e) {
    e.preventDefault();
    if (!novo.insumo_id) return;
    await api.post('/almoxarifado/plano', { atividade, insumo_id: novo.insumo_id, qtd_por_pavimento: novo.qtd_por_pavimento });
    setNovo({ insumo_id: '', qtd_por_pavimento: '' });
    carregar(atividade);
  }
  async function remover(id) { await api.delete(`/almoxarifado/plano/${id}`); carregar(atividade); }

  return (
    <div className="space-y-4">
      <div className="card">
        <label className="label">Atividade</label>
        <select className="input max-w-md" value={atividade} onChange={e => setAtividade(e.target.value)}>
          <option value="">Selecione uma atividade...</option>
          {atividades.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <p className="text-xs text-slate-400 mt-2">Defina quanto de cada insumo esta atividade consome <strong>por pavimento</strong> (consumo previsto). Isso vira a referência comparada com o retirado.</p>
      </div>

      {atividade && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
              <tr><th className="py-2.5 px-4">Insumo</th><th className="py-2.5 px-3 text-right">Qtd / pavimento</th><th className="py-2.5 px-3"></th></tr>
            </thead>
            <tbody>
              {plano.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-slate-400">Nenhum insumo previsto para esta atividade.</td></tr>}
              {plano.map(p => (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="py-2 px-4 text-slate-700">{p.descricao}</td>
                  <td className="py-2 px-3 text-right font-medium">{fmt(p.qtd_por_pavimento)} {p.unidade}</td>
                  <td className="py-2 px-3 text-right">{podePlanejar && <button onClick={() => remover(p.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {podePlanejar && (
            <form onSubmit={adicionar} className="flex items-end gap-3 p-4 border-t border-slate-100 bg-slate-50">
              <div className="flex-1"><label className="label">Insumo</label>
                <select className="input" value={novo.insumo_id} onChange={e => setNovo({ ...novo, insumo_id: e.target.value })} required>
                  <option value="">Selecione...</option>
                  {insumos.map(i => <option key={i.id} value={i.id}>{i.descricao} ({i.unidade})</option>)}
                </select>
              </div>
              <div className="w-40"><label className="label">Qtd / pavimento</label><input type="number" step="any" min="0" className="input" value={novo.qtd_por_pavimento} onChange={e => setNovo({ ...novo, qtd_por_pavimento: e.target.value })} required /></div>
              <button className="btn-primary">Adicionar</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ── Aba Fichas de Retirada ───────────────────────────────────────────────────

function TabRetiradas({ insumos, lb, podeEditar, onChange }) {
  const [fichas, setFichas] = useState([]);
  const [modal, setModal] = useState(false);
  function carregar() { api.get('/almoxarifado/fichas').then(r => setFichas(r.data)); }
  useEffect(() => { carregar(); }, []);

  return (
    <div className="space-y-4">
      {podeEditar && <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Nova ficha de retirada</button>}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
            <tr><th className="py-2.5 px-4">Data</th><th className="py-2.5 px-3">Pavimento</th><th className="py-2.5 px-3">Atividade</th><th className="py-2.5 px-3">Responsável</th><th className="py-2.5 px-3 text-right">Itens</th></tr>
          </thead>
          <tbody>
            {fichas.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-slate-400">Nenhuma ficha registrada.</td></tr>}
            {fichas.map(f => (
              <tr key={f.id} className="border-b border-slate-50">
                <td className="py-2 px-4 text-slate-600">{f.data?.split('-').reverse().join('/')}</td>
                <td className="py-2 px-3 text-slate-700 font-medium">{f.pavimento}</td>
                <td className="py-2 px-3 text-slate-600">{f.atividade}</td>
                <td className="py-2 px-3 text-slate-500">{f.responsavel || f.usuario_nome || '—'}</td>
                <td className="py-2 px-3 text-right text-slate-500">{f.num_itens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <ModalFicha insumos={insumos} lb={lb} onFechar={() => setModal(false)} onSalvo={() => { setModal(false); carregar(); onChange(); }} />}
    </div>
  );
}

function ModalFicha({ insumos, lb, onFechar, onSalvo }) {
  const [cab, setCab] = useState({ data: hoje(), pavimento: '', atividade: '', responsavel: '', observacao: '' });
  const [itens, setItens] = useState([{ insumo_id: '', quantidade: '' }]);
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState('');

  function setItem(idx, campo, val) { setItens(its => its.map((it, i) => i === idx ? { ...it, [campo]: val } : it)); }
  function addItem() { setItens(its => [...its, { insumo_id: '', quantidade: '' }]); }
  function delItem(idx) { setItens(its => its.filter((_, i) => i !== idx)); }

  async function salvar(e) {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      await api.post('/almoxarifado/fichas', { ...cab, itens: itens.filter(it => it.insumo_id && it.quantidade) });
      onSalvo();
    } catch (err) { setErro(err.response?.data?.error || 'Erro'); } finally { setSalvando(false); }
  }

  return (
    <Modal titulo="Nova ficha de retirada" largo onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Data</label><input type="date" className="input" value={cab.data} onChange={e => setCab({ ...cab, data: e.target.value })} required /></div>
          <div><label className="label">Responsável</label><input className="input" value={cab.responsavel} onChange={e => setCab({ ...cab, responsavel: e.target.value })} placeholder="Quem retirou" /></div>
          <div><label className="label">Pavimento *</label>
            <select className="input" value={cab.pavimento} onChange={e => setCab({ ...cab, pavimento: e.target.value })} required>
              <option value="">Selecione...</option>{lb.pavimentos.map(p => <option key={p} value={p}>{p}</option>)}
            </select></div>
          <div><label className="label">Atividade *</label>
            <select className="input" value={cab.atividade} onChange={e => setCab({ ...cab, atividade: e.target.value })} required>
              <option value="">Selecione...</option>{lb.atividades.map(a => <option key={a} value={a}>{a}</option>)}
            </select></div>
        </div>

        <div>
          <label className="label">Materiais retirados</label>
          <div className="space-y-2">
            {itens.map((it, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select className="input flex-1" value={it.insumo_id} onChange={e => setItem(idx, 'insumo_id', e.target.value)}>
                  <option value="">Selecione o insumo...</option>
                  {insumos.map(i => <option key={i.id} value={i.id}>{i.descricao} ({i.unidade}) · estoque {fmt(i.estoque_atual)}</option>)}
                </select>
                <input type="number" step="any" min="0" className="input w-28" placeholder="Qtd" value={it.quantidade} onChange={e => setItem(idx, 'quantidade', e.target.value)} />
                {itens.length > 1 && <button type="button" onClick={() => delItem(idx)} className="text-slate-400 hover:text-red-600"><X size={16} /></button>}
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="text-xs text-cora-600 mt-2 flex items-center gap-1"><Plus size={13} /> Adicionar item</button>
        </div>

        <div><label className="label">Observação</label><textarea className="input resize-none" rows={2} value={cab.observacao} onChange={e => setCab({ ...cab, observacao: e.target.value })} /></div>
        {erro && <div className="text-sm text-red-600">{erro}</div>}
        <div className="flex justify-end gap-3"><button type="button" onClick={onFechar} className="btn-secondary">Cancelar</button><button disabled={salvando} className="btn-primary">{salvando ? 'Salvando...' : 'Registrar retirada'}</button></div>
      </form>
    </Modal>
  );
}

// ── Aba Apropriação ──────────────────────────────────────────────────────────

function TabApropriacao({ atividades, pavimentos }) {
  const [atividade, setAtividade] = useState('');
  const [pavimento, setPavimento] = useState('');
  const [dados, setDados] = useState(null);

  useEffect(() => {
    if (!atividade) { setDados(null); return; }
    let url = `/almoxarifado/apropriacao?atividade=${encodeURIComponent(atividade)}`;
    if (pavimento) url += `&pavimento=${encodeURIComponent(pavimento)}`;
    api.get(url).then(r => setDados(r.data));
  }, [atividade, pavimento]);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap gap-4 items-end">
        <div><label className="label">Atividade</label>
          <select className="input" value={atividade} onChange={e => setAtividade(e.target.value)}>
            <option value="">Selecione...</option>{atividades.map(a => <option key={a} value={a}>{a}</option>)}
          </select></div>
        <div><label className="label">Pavimento (opcional)</label>
          <select className="input" value={pavimento} onChange={e => setPavimento(e.target.value)}>
            <option value="">Todos os pavimentos</option>{pavimentos.map(p => <option key={p} value={p}>{p}</option>)}
          </select></div>
      </div>

      {dados && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
              <tr><th className="py-2.5 px-4">Insumo</th><th className="py-2.5 px-3 text-right">Previsto{pavimento ? '' : '/pav'}</th><th className="py-2.5 px-3 text-right">Retirado</th><th className="py-2.5 px-3 text-right">Saldo</th><th className="py-2.5 px-3 text-right">%</th></tr>
            </thead>
            <tbody>
              {dados.linhas.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Sem previsão nem retirada para esta seleção.</td></tr>}
              {dados.linhas.map(l => {
                const excedeu = l.pct != null && l.pct > 1;
                return (
                  <tr key={l.insumo_id} className="border-b border-slate-50">
                    <td className="py-2 px-4 text-slate-700">{l.descricao} <span className="text-slate-400">({l.unidade})</span></td>
                    <td className="py-2 px-3 text-right text-slate-500">{fmt(l.previsto)}</td>
                    <td className="py-2 px-3 text-right font-medium">{fmt(l.retirado)}</td>
                    <td className={`py-2 px-3 text-right ${l.saldo < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(l.saldo)}</td>
                    <td className={`py-2 px-3 text-right font-medium ${excedeu ? 'text-red-600' : 'text-slate-600'}`}>{l.pct == null ? '—' : (l.pct * 100).toFixed(0) + '%'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!pavimento && <p className="text-xs text-slate-400 p-3">Previsto é por pavimento; retirado é o total da atividade em todos os pavimentos. Selecione um pavimento para comparar 1:1.</p>}
        </div>
      )}
    </div>
  );
}

// ── Modal genérico ───────────────────────────────────────────────────────────

function Modal({ titulo, children, onFechar, largo }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${largo ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">{titulo}</h2>
          <button onClick={onFechar}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
