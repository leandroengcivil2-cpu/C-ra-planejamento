import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { AlertTriangle, Plus, X } from 'lucide-react';

// ── Paleta de cores por atividade ────────────────────────────────────────────
const CORES = [
  '#2563eb','#16a34a','#f59e0b','#dc2626','#7c3aed','#0891b2','#ea580c','#65a30d',
  '#db2777','#0d9488','#4f46e5','#84cc16','#f97316','#0284c7','#c026d3','#059669',
  '#9333ea','#ca8a04','#e11d48','#0ea5e9','#7e22ce','#15803d','#b45309','#be123c',
  '#1d4ed8','#4d7c0f','#a21caf','#047857','#b91c1c','#6d28d9','#a16207','#1e40af'
];

// Siglas curadas para atividades conhecidas (fallback gera automaticamente)
const SIGLAS = {
  'Estrutura': 'EST', 'Alvenaria': 'ALV', 'Encunhamento': 'ENC',
  'Chapisco/Emboço': 'EMB', 'Emboço': 'EMB', 'Chapisco externo': 'CHE',
  'Emboço externo': 'EME', 'Contrapiso': 'CTP', 'Impermeabilização': 'IMP',
  'Instalações 1': 'IN1', 'Instalações 2': 'IN2', 'Forro': 'FOR',
  'Revestimentos 1': 'RV1', 'Revestimentos Sacada': 'RVS', 'Revestimento de piso': 'RVP',
  'Serralheria': 'SER', 'Portas': 'PRT', 'Limpeza': 'LMP', 'Limpeza Grossa': 'LG',
  'Limpeza Fina': 'LF', 'Pintura 1': 'P1', 'Pintura 2': 'P2',
  'Acabamentos 1': 'AC1', 'Acabamentos 2': 'AC2', 'Churras + shafts': 'CHS',
  'Vistorias': 'VIS', 'Montagem balancim': 'BAL', 'Selador e textura': 'SLT',
  'Molduras e tijoletas': 'MOL', 'Pintura (fachada)': 'PF', 'Taliscamento': 'TAL'
};

function removerAcentos(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function gerarSigla(nome) {
  if (SIGLAS[nome]) return SIGLAS[nome];
  const limpo = removerAcentos(nome).trim();
  const palavras = limpo.split(/[\s/+\-]+/).filter(Boolean);
  if (palavras.length >= 2) {
    return (palavras[0][0] + palavras[1].slice(0, 2)).toUpperCase();
  }
  return limpo.slice(0, 3).toUpperCase();
}

// Ordem dos pavimentos (índice maior = mais alto). Térreo embaixo.
const ORDEM = [
  'Térro', 'Térreo', '2o Pav', '3o Pav', '4o Pav', '5o Pav', '6o Pav', '7o Pav',
  '8o Pav', 'Ático', 'Fachada Frente', 'Fachada Fundos', 'Fachada Lat. Dir.', 'Fachada Lat. Esq'
];
function ordemPav(nome) {
  const i = ORDEM.findIndex(p => p === nome || nome.includes(p.replace('o Pav', '').trim()));
  return i === -1 ? 99 : i;
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// Segunda-feira da semana de uma data ISO
function segundaDaSemana(iso) {
  const d = new Date(iso + 'T00:00:00');
  const dia = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - dia);
  return d.toISOString().slice(0, 10);
}

function fmtDataBR(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// ── Grade de Linha de Balanço ────────────────────────────────────────────────

function GradeLB({ dados, onClickAtividade }) {
  const modelo = useMemo(() => {
    if (!dados.length) return null;

    const atividadesUnicas = [...new Set(dados.map(d => d.atividade).filter(Boolean))];
    const corMap = {}, siglaMap = {};
    atividadesUnicas.forEach((a, i) => {
      corMap[a] = CORES[i % CORES.length];
      siglaMap[a] = gerarSigla(a);
    });

    const pavimentos = [...new Set(dados.map(d => d.pavimento))]
      .sort((a, b) => ordemPav(b) - ordemPav(a));

    const semanasSet = [...new Set(dados.map(d => segundaDaSemana(d.data)))].sort();

    const celulas = {};
    for (const d of dados) {
      const sem = segundaDaSemana(d.data);
      const chave = `${d.pavimento}|${sem}`;
      if (!celulas[chave]) celulas[chave] = {};
      if (d.atividade) celulas[chave][d.atividade] = (celulas[chave][d.atividade] || 0) + 1;
    }
    const celulaAtiv = {};
    for (const [chave, conta] of Object.entries(celulas)) {
      const dominante = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
      if (dominante) celulaAtiv[chave] = dominante[0];
    }

    const meses = [];
    for (const sem of semanasSet) {
      const [y, m] = sem.split('-');
      const label = `${MESES[parseInt(m) - 1]}/${y.slice(2)}`;
      const ultimo = meses[meses.length - 1];
      if (ultimo && ultimo.label === label) ultimo.span++;
      else meses.push({ label, span: 1 });
    }

    return { atividadesUnicas, corMap, siglaMap, pavimentos, semanas: semanasSet, celulaAtiv, meses };
  }, [dados]);

  if (!modelo) return null;
  const { atividadesUnicas, corMap, siglaMap, pavimentos, semanas, celulaAtiv, meses } = modelo;

  const LARG_PAV = 110;
  const LARG_SEM = 30;
  const hoje = segundaDaSemana(new Date().toISOString().slice(0, 10));

  return (
    <div>
      {/* Legenda */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-4">
        {atividadesUnicas.map(a => (
          <button
            key={a}
            onClick={() => onClickAtividade(a)}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
            title={`Ver histograma de ${a}`}
          >
            <span className="inline-flex items-center justify-center w-7 h-4 rounded text-[9px] font-bold text-white"
              style={{ backgroundColor: corMap[a] }}>
              {siglaMap[a]}
            </span>
            {a}
          </button>
        ))}
      </div>

      {/* Grade */}
      <div className="overflow-auto border border-slate-200 rounded-lg" style={{ maxHeight: '70vh' }}>
        <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-20">
            <tr>
              <th rowSpan={2} className="sticky left-0 z-30 bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 px-2"
                style={{ width: LARG_PAV, minWidth: LARG_PAV }}>
                Pavimento
              </th>
              {meses.map((m, i) => (
                <th key={i} colSpan={m.span}
                  className="bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600 text-center"
                  style={{ minWidth: m.span * LARG_SEM }}>
                  {m.label}
                </th>
              ))}
            </tr>
            <tr>
              {semanas.map(sem => (
                <th key={sem}
                  className={`border border-slate-200 text-[8px] text-slate-400 text-center font-normal ${sem === hoje ? 'bg-red-50' : 'bg-white'}`}
                  style={{ width: LARG_SEM, minWidth: LARG_SEM }}
                  title={`Semana de ${fmtDataBR(sem)}`}>
                  {fmtDataBR(sem).slice(0, 2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pavimentos.map(pav => (
              <tr key={pav}>
                <td className="sticky left-0 z-10 bg-white border border-slate-200 text-xs font-medium text-slate-700 px-2 whitespace-nowrap"
                  style={{ width: LARG_PAV, minWidth: LARG_PAV }}>
                  {pav}
                </td>
                {semanas.map(sem => {
                  const ativ = celulaAtiv[`${pav}|${sem}`];
                  const ehHoje = sem === hoje;
                  return (
                    <td key={sem}
                      onClick={() => ativ && onClickAtividade(ativ)}
                      className={`border border-slate-100 text-center align-middle ${ativ ? 'cursor-pointer' : ''} ${ehHoje ? 'ring-1 ring-red-300 ring-inset' : ''}`}
                      style={{
                        width: LARG_SEM, minWidth: LARG_SEM, height: 22,
                        backgroundColor: ativ ? corMap[ativ] : 'transparent'
                      }}
                      title={ativ ? `${pav} — ${ativ} (semana de ${fmtDataBR(sem)})` : ''}>
                      {ativ && (
                        <span className="text-[7px] font-bold text-white leading-none">
                          {siglaMap[ativ]}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Cada célula = atividade planejada naquele pavimento/semana. Clique numa atividade (ou na legenda) para ver o histograma de ciclo. A coluna destacada em vermelho é a semana atual.
      </p>
    </div>
  );
}

// ── Histograma de ciclo ──────────────────────────────────────────────────────

function HistogramaCiclo({ atividade, onFechar }) {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/lb/histograma/${encodeURIComponent(atividade)}`)
      .then(r => setDados(r.data))
      .finally(() => setLoading(false));
  }, [atividade]);

  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700">
          Histograma de Ciclo — <span className="text-cora-600">{atividade}</span>
        </h3>
        <button onClick={onFechar} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
      </div>

      {loading && <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>}
      {!loading && dados.length === 0 && (
        <div className="text-slate-400 text-sm py-8 text-center">Sem dados para esta atividade</div>
      )}
      {!loading && dados.length > 0 && (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="pavimento" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={48} />
            <YAxis tick={{ fontSize: 11 }} label={{ value: 'Dias', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="dias_planejados" name="Planejado" fill="#2563eb" opacity={0.7} radius={[4,4,0,0]} />
            <Bar dataKey="dias_reais" name="Realizado" fill="#16a34a" opacity={0.85} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Modal de lançamento de campo ─────────────────────────────────────────────

function ModalLancamento({ onFechar, onSalvo }) {
  const [form, setForm] = useState({
    data: new Date().toISOString().split('T')[0],
    pavimento: '', atividade: '', status: 'em_andamento', pct_avanco: '', observacao: ''
  });
  const [alerta, setAlerta] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [opcoes, setOpcoes] = useState({ atividades: [], pavimentos: [] });

  useEffect(() => {
    api.get('/lb/planejado').then(r => {
      setOpcoes({ atividades: r.data.atividades || [], pavimentos: r.data.pavimentos || [] });
    });
  }, []);

  async function handleSalvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const { data } = await api.post('/lb/campo', {
        ...form, pct_avanco: parseFloat(form.pct_avanco) / 100 || 0
      });
      if (data.alerta) setAlerta(data.alerta);
      else onSalvo();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">Lançamento Diário</h2>
          <button onClick={onFechar}><X size={20} className="text-slate-400" /></button>
        </div>

        {alerta && (
          <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-amber-800">{alerta.mensagem}</div>
              <button onClick={onSalvo} className="text-xs text-amber-600 underline mt-1">Fechar e continuar</button>
            </div>
          </div>
        )}

        <form onSubmit={handleSalvar} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Data</label>
              <input type="date" className="input" value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="iniciado">Iniciado</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
                <option value="paralisado">Paralisado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Atividade</label>
            <select className="input" value={form.atividade}
              onChange={e => setForm(f => ({ ...f, atividade: e.target.value }))} required>
              <option value="">Selecione...</option>
              {opcoes.atividades.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Pavimento</label>
            <select className="input" value={form.pavimento}
              onChange={e => setForm(f => ({ ...f, pavimento: e.target.value }))} required>
              <option value="">Selecione...</option>
              {opcoes.pavimentos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">% de avanço no pavimento (0–100)</label>
            <input type="number" min="0" max="100" className="input" value={form.pct_avanco}
              onChange={e => setForm(f => ({ ...f, pct_avanco: e.target.value }))} />
          </div>
          <div>
            <label className="label">Observação</label>
            <textarea className="input resize-none" rows={2} value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onFechar} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-primary">
              {salvando ? 'Salvando...' : 'Salvar lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function LinhaBalancoPage() {
  const { user } = useAuth();
  const [dados, setDados] = useState([]);
  const [meta, setMeta] = useState({ atividades: [], pavimentos: [], datas: [] });
  const [loading, setLoading] = useState(true);
  const [atividadeSel, setAtividadeSel] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);

  const podeEditar = ['gestor', 'engenheiro', 'admin'].includes(user?.perfil);

  useEffect(() => {
    api.get('/lb/planejado')
      .then(r => {
        setDados(r.data.dados || []);
        setMeta({
          atividades: r.data.atividades || [],
          pavimentos: r.data.pavimentos || [],
          datas: r.data.datas || []
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const periodo = meta.datas.length
    ? `${fmtDataBR(meta.datas[0])} a ${fmtDataBR(meta.datas[meta.datas.length - 1])}`
    : '';

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Linha de Balanço</h1>
          {!loading && dados.length > 0 && (
            <p className="text-slate-500 text-sm mt-0.5">
              {meta.atividades.length} atividades · {meta.pavimentos.length} pavimentos · período {periodo}
            </p>
          )}
        </div>
        {podeEditar && (
          <button onClick={() => setModalAberto(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Lançamento diário
          </button>
        )}
      </div>

      {loading && <div className="card text-center py-16 text-slate-400">Carregando linha de balanço...</div>}

      {!loading && dados.length === 0 && (
        <div className="card text-center py-16">
          <p className="text-slate-500">Nenhum dado de Linha de Balanço.</p>
          <p className="text-slate-400 text-sm mt-1">Importe o Cronograma Corá.xlsm primeiro.</p>
        </div>
      )}

      {!loading && dados.length > 0 && (
        <>
          <div className="card">
            <GradeLB dados={dados} onClickAtividade={a => setAtividadeSel(a === atividadeSel ? null : a)} />
          </div>
          {atividadeSel && (
            <HistogramaCiclo atividade={atividadeSel} onFechar={() => setAtividadeSel(null)} />
          )}
        </>
      )}

      {modalAberto && (
        <ModalLancamento onFechar={() => setModalAberto(false)} onSalvo={() => setModalAberto(false)} />
      )}
    </div>
  );
}
