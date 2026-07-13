import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { AlertTriangle, Plus, X, RotateCcw, Move, Info } from 'lucide-react';

// ── Cores e siglas ───────────────────────────────────────────────────────────
const CORES = [
  '#2563eb','#16a34a','#f59e0b','#dc2626','#7c3aed','#0891b2','#ea580c','#65a30d',
  '#db2777','#0d9488','#4f46e5','#84cc16','#f97316','#0284c7','#c026d3','#059669',
  '#9333ea','#ca8a04','#e11d48','#0ea5e9','#7e22ce','#15803d','#b45309','#be123c',
  '#1d4ed8','#4d7c0f','#a21caf','#047857','#b91c1c','#6d28d9','#a16207','#1e40af'
];
const SIGLAS = {
  'Estrutura':'EST','Alvenaria':'ALV','Churrasqueira':'CHU',
  'Instalação Hidráulica 1':'HI1','Instalação Elétrica 1':'EL1','Comunicação':'COM','Gás':'GAS',
  'Emboço Interno':'EMB','Contrapiso':'CTP','Drywall Estrutura':'DWE',
  'Instalação Hidrossanitária Drywall':'HDW','Instalação Elétrica Drywall':'EDW','Ar Condicionado Drywall':'ADW',
  'Drywall Plaqueamento':'PDW','Impermeabilização':'IMP','Revestimento Cerâmico':'RCE','Cabeamento':'CAB',
  'Forro':'FOR','Emassamento':'EMA','Pintura 1ª Demão':'P1','Pintura 2ª Demão':'P2',
  'Limpeza Grossa':'LG','Louças':'LOU','Metais':'MET','Acabamentos Elétrico':'AEL',
  'Portas de Madeira':'PRT','Piso Vinílico':'PVI','Limpeza Fina':'LF','Vistoria Interna':'VIS',
  'Fundação':'FUN','Fachada 1ª Metade':'FA1','Fachada 2ª Metade':'FA2',
  'Esquadria de Alumínio':'ESQ','Elevador':'ELV'
};
// Fases de edifício (não são pavimentos — aparecem no rodapé da grade)
const FASES_EDIFICIO = ['Fundação', 'Fachada 1ª Metade', 'Fachada 2ª Metade', 'Esquadria de Alumínio', 'Elevador'];

function gerarSigla(nome) {
  if (SIGLAS[nome]) return SIGLAS[nome];
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const p = limpo.split(/[\s/+\-]+/).filter(Boolean);
  return (p.length >= 2 ? (p[0][0] + p[1].slice(0, 2)) : limpo.slice(0, 3)).toUpperCase();
}

// ── Datas ────────────────────────────────────────────────────────────────────
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function diffDias(a, b) { return Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00')) / 86400000); }
function addDias(iso, n) { const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function mondayOf(iso) { const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d.toISOString().slice(0,10); }
function fmtBR(iso) { if (!iso) return ''; const [,m,d] = iso.split('-'); return `${d}/${m}`; }
function hojeISO() { return new Date().toISOString().slice(0,10); }

const DIA_W = 5;         // largura de 1 dia em px
const ROW_H = 30;        // altura de cada linha de pavimento
const LARG_PAV = 120;    // largura da coluna de pavimentos

// ── Timeline interativa ──────────────────────────────────────────────────────

function TimelineLB({ segmentos, pavimentos, periodo, corMap, siglaMap, onDrop, onSelect, selecionada }) {
  const scrollRef = useRef(null);
  const [drag, setDrag] = useState(null); // { atividade, pavimento, origInicio, origLeft, deltaSemanas, moveu }

  const inicioTL = useMemo(() => periodo.inicio ? mondayOf(periodo.inicio) : null, [periodo.inicio]);
  const totalDias = useMemo(() => {
    if (!periodo.inicio || !periodo.fim) return 0;
    return diffDias(inicioTL, periodo.fim) + 14;
  }, [inicioTL, periodo.fim]);

  const larguraTL = totalDias * DIA_W;
  const leftDe = useCallback((iso) => diffDias(inicioTL, iso) * DIA_W, [inicioTL]);

  // Cabeçalho de meses
  const meses = useMemo(() => {
    if (!inicioTL) return [];
    const out = [];
    let cursor = inicioTL;
    while (diffDias(inicioTL, cursor) < totalDias) {
      const [y, m] = cursor.split('-');
      const label = `${MESES[parseInt(m)-1]}/${y.slice(2)}`;
      const proxMes = new Date(parseInt(y), parseInt(m), 1).toISOString().slice(0,10);
      const fimSeg = diffDias(inicioTL, proxMes) < totalDias ? proxMes : addDias(inicioTL, totalDias);
      out.push({ label, left: leftDe(cursor), width: diffDias(cursor, fimSeg) * DIA_W });
      cursor = proxMes;
    }
    return out;
  }, [inicioTL, totalDias, leftDe]);

  const pavsOrdenados = pavimentos; // já vem ordenado (menor->maior); exibimos alto em cima
  const linhas = [...pavsOrdenados].reverse();

  // Drag global
  useEffect(() => {
    if (!drag) return;
    function onMove(e) {
      const dx = e.clientX - drag.startX;
      const deltaSemanas = Math.round(dx / (DIA_W * 7));
      setDrag(d => d && { ...d, deltaSemanas, moveu: d.moveu || Math.abs(dx) > 4 });
    }
    function onUp() {
      setDrag(d => {
        if (d && d.moveu && d.deltaSemanas !== 0) {
          onDrop({
            atividade: d.atividade, pavimento: d.pavimento,
            origInicio: d.origInicio, deltaDias: d.deltaSemanas * 7
          });
        } else if (d && !d.moveu) {
          onSelect(d.atividade);
        }
        return null;
      });
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [drag, onDrop, onSelect]);

  if (!inicioTL) return null;
  const hoje = hojeISO();
  const hojeLeft = (hoje >= periodo.inicio && hoje <= periodo.fim) ? leftDe(hoje) : null;

  const larguraTotal = LARG_PAV + larguraTL;

  return (
    <div ref={scrollRef} className="border border-slate-200 rounded-lg overflow-auto" style={{ maxHeight: '72vh' }}>
      <div style={{ width: larguraTotal, position: 'relative' }}>
        {/* Cabeçalho (sticky top) */}
        <div className="sticky top-0 z-30 flex bg-slate-100 border-b border-slate-200" style={{ height: 44 }}>
          <div className="sticky left-0 z-10 shrink-0 bg-slate-100 border-r border-slate-200 flex items-end px-2 text-xs font-semibold text-slate-600"
            style={{ width: LARG_PAV }}>Pavimento</div>
          <div className="relative" style={{ width: larguraTL }}>
            {meses.map((m, i) => (
              <div key={i} className="absolute top-0 border-l border-slate-200 text-[10px] font-semibold text-slate-600 px-1 pt-1"
                style={{ left: m.left, width: m.width, height: 44 }}>{m.label}</div>
            ))}
          </div>
        </div>

        {/* Linha do "hoje" (abaixo do cabeçalho, atrás dos rótulos) */}
        {hojeLeft != null && (
          <div className="absolute z-0 pointer-events-none" style={{ left: LARG_PAV + hojeLeft, top: 44, bottom: 0, width: 2, background: '#ef4444' }} />
        )}

        {/* Linhas: rótulo fixo à esquerda + barras, no MESMO elemento */}
        {linhas.map(pav => {
          const segs = segmentos.filter(s => s.pavimento === pav);
          const ehFase = FASES_EDIFICIO.includes(pav);
          return (
            <div key={pav} className="flex border-b border-slate-100" style={{ height: ROW_H }}>
              <div className={`sticky left-0 z-10 shrink-0 border-r border-slate-200 flex items-center px-2 text-xs whitespace-nowrap ${ehFase ? 'bg-slate-50 font-semibold text-slate-500 italic' : 'bg-white font-medium text-slate-700'}`}
                style={{ width: LARG_PAV }}>{pav}</div>
              <div className="relative" style={{ width: larguraTL }}>
                {segs.map(s => {
                  const cor = corMap[s.atividade];
                  const sel = selecionada === s.atividade;
                  const arrastando = drag && drag.atividade === s.atividade && drag.pavimento === s.pavimento;
                  const offset = arrastando && drag.moveu ? drag.deltaSemanas * 7 * DIA_W : 0;
                  return (
                    <div key={s.pavimento + s.atividade}>
                      {s.replanejado && (
                        <div className="absolute rounded border border-dashed"
                          style={{
                            left: leftDe(s.base_inicio), top: 6, height: ROW_H - 12,
                            width: Math.max(DIA_W, (diffDias(s.base_inicio, s.base_fim)+1) * DIA_W),
                            borderColor: cor, opacity: 0.5
                          }}
                          title={`Linha de base: ${fmtBR(s.base_inicio)}–${fmtBR(s.base_fim)}`} />
                      )}
                      <div
                        onPointerDown={(e) => {
                          e.preventDefault();
                          setDrag({ atividade: s.atividade, pavimento: s.pavimento, origInicio: s.inicio,
                            startX: e.clientX, deltaSemanas: 0, moveu: false });
                        }}
                        className={`absolute rounded flex items-center justify-center cursor-grab active:cursor-grabbing select-none ${sel ? 'ring-2 ring-offset-1 ring-slate-800' : ''}`}
                        style={{
                          left: leftDe(s.inicio) + offset, top: 5, height: ROW_H - 10,
                          width: Math.max(DIA_W * 2, (diffDias(s.inicio, s.fim)+1) * DIA_W),
                          backgroundColor: cor, zIndex: arrastando ? 40 : 5,
                          boxShadow: arrastando ? '0 4px 12px rgba(0,0,0,0.3)' : 'none'
                        }}
                        title={`${s.atividade} — ${s.pavimento}\n${fmtBR(s.inicio)} a ${fmtBR(s.fim)}${s.replanejado ? ' (replanejado)' : ''}\nArraste para replanejar · clique para ver ciclo`}>
                        <span className="text-[8px] font-bold text-white leading-none px-0.5 truncate">
                          {siglaMap[s.atividade]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Modal de replanejamento ──────────────────────────────────────────────────

function ModalReplan({ dados, corMap, onFechar, onConfirmado }) {
  const { atividade, pavimento, origInicio, deltaDias } = dados;
  const novaInicio = addDias(origInicio, deltaDias);
  const tipo = deltaDias > 0 ? 'atraso' : 'antecipacao';
  const [motivo, setMotivo] = useState('');
  const [cascata, setCascata] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function confirmar() {
    if (tipo === 'atraso' && !motivo.trim()) { setErro('Justificativa é obrigatória para atrasos.'); return; }
    setSalvando(true); setErro('');
    try {
      const { data } = await api.post('/lb/replanejar', {
        atividade, pavimento, nova_inicio: novaInicio, motivo: motivo.trim(), cascata
      });
      onConfirmado(data);
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao replanejar');
    } finally { setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">Replanejar atividade</h2>
          <button onClick={onFechar}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-9 h-6 rounded text-[10px] font-bold text-white"
              style={{ backgroundColor: corMap[atividade] }}>{gerarSigla(atividade)}</span>
            <div>
              <div className="font-medium text-slate-800 text-sm">{atividade}</div>
              <div className="text-xs text-slate-500">{pavimento}</div>
            </div>
          </div>

          <div className={`rounded-lg px-4 py-3 text-sm ${tipo === 'atraso' ? 'bg-orange-50 text-orange-800' : 'bg-emerald-50 text-emerald-800'}`}>
            <div className="flex items-center justify-between">
              <span>{fmtBR(origInicio)}</span>
              <span>→</span>
              <span className="font-semibold">{fmtBR(novaInicio)}</span>
            </div>
            <div className="text-center mt-1 font-medium">
              {tipo === 'atraso' ? `Atraso de ${Math.abs(deltaDias)} dias` : `Antecipação de ${Math.abs(deltaDias)} dias`}
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={cascata} onChange={e => setCascata(e.target.checked)} className="mt-0.5" />
            <span className="text-sm text-slate-600">
              Recalcular os pavimentos seguintes (manter o ciclo). Desmarque para mover só este pavimento.
            </span>
          </label>

          <div>
            <label className="label">
              Justificativa {tipo === 'atraso' && <span className="text-red-500">*</span>}
            </label>
            <textarea className="input resize-none" rows={2} value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder={tipo === 'atraso' ? 'Ex: chuva, atraso de material...' : 'Motivo da antecipação (opcional)'} />
          </div>

          {erro && <div className="text-sm text-red-600">{erro}</div>}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
          <button onClick={onFechar} className="btn-secondary">Cancelar</button>
          <button onClick={confirmar} disabled={salvando} className="btn-primary">
            {salvando ? 'Salvando...' : 'Confirmar replanejamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Histograma de ciclo ──────────────────────────────────────────────────────

function HistogramaCiclo({ atividade, onFechar }) {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.get(`/lb/histograma/${encodeURIComponent(atividade)}`).then(r => setDados(r.data)).finally(() => setLoading(false));
  }, [atividade]);

  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700">Histograma de Ciclo — <span className="text-cora-600">{atividade}</span></h3>
        <button onClick={onFechar} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
      </div>
      {loading && <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>}
      {!loading && dados.length === 0 && <div className="text-slate-400 text-sm py-8 text-center">Sem dados</div>}
      {!loading && dados.length > 0 && (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="pavimento" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={48} />
            <YAxis tick={{ fontSize: 11 }} label={{ value: 'Dias', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip /><Legend />
            <Bar dataKey="dias_planejados" name="Planejado" fill="#2563eb" opacity={0.7} radius={[4,4,0,0]} />
            <Bar dataKey="dias_reais" name="Realizado" fill="#16a34a" opacity={0.85} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Modal de lançamento de campo ─────────────────────────────────────────────

function ModalLancamento({ opcoes, onFechar, onSalvo }) {
  const [form, setForm] = useState({
    data: hojeISO(), pavimento: '', atividade: '', status: 'em_andamento', pct_avanco: '', observacao: ''
  });
  const [alerta, setAlerta] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar(e) {
    e.preventDefault(); setSalvando(true);
    try {
      const { data } = await api.post('/lb/campo', { ...form, pct_avanco: parseFloat(form.pct_avanco)/100 || 0 });
      if (data.alerta) setAlerta(data.alerta); else onSalvo();
    } catch (err) { alert(err.response?.data?.error || 'Erro ao salvar'); }
    finally { setSalvando(false); }
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
              <button onClick={onSalvo} className="text-xs text-amber-600 underline mt-1">Fechar</button>
            </div>
          </div>
        )}
        <form onSubmit={handleSalvar} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Data</label>
              <input type="date" className="input" value={form.data} onChange={e => setForm(f => ({...f, data:e.target.value}))} required /></div>
            <div><label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({...f, status:e.target.value}))}>
                <option value="iniciado">Iniciado</option><option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option><option value="paralisado">Paralisado</option>
              </select></div>
          </div>
          <div><label className="label">Atividade</label>
            <select className="input" value={form.atividade} onChange={e => setForm(f => ({...f, atividade:e.target.value}))} required>
              <option value="">Selecione...</option>
              {opcoes.atividades.map(a => <option key={a} value={a}>{a}</option>)}
            </select></div>
          <div><label className="label">Pavimento</label>
            <select className="input" value={form.pavimento} onChange={e => setForm(f => ({...f, pavimento:e.target.value}))} required>
              <option value="">Selecione...</option>
              {opcoes.pavimentos.map(p => <option key={p} value={p}>{p}</option>)}
            </select></div>
          <div><label className="label">% de avanço no pavimento (0–100)</label>
            <input type="number" min="0" max="100" className="input" value={form.pct_avanco} onChange={e => setForm(f => ({...f, pct_avanco:e.target.value}))} /></div>
          <div><label className="label">Observação</label>
            <textarea className="input resize-none" rows={2} value={form.observacao} onChange={e => setForm(f => ({...f, observacao:e.target.value}))} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onFechar} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function LinhaBalancoPage() {
  const { user } = useAuth();
  const [resp, setResp] = useState({ segmentos: [], atividades: [], pavimentos: [], periodo: {} });
  const [loading, setLoading] = useState(true);
  const [selecionada, setSelecionada] = useState(null);
  const [replanData, setReplanData] = useState(null);
  const [lancamento, setLancamento] = useState(false);
  const podeReplanejar = ['gestor', 'admin'].includes(user?.perfil);
  const podeEditar = ['gestor', 'engenheiro', 'admin'].includes(user?.perfil);

  function carregar() {
    setLoading(true);
    api.get('/lb/segmentos').then(r => setResp(r.data)).finally(() => setLoading(false));
  }
  useEffect(() => { carregar(); }, []);

  const { corMap, siglaMap } = useMemo(() => {
    const c = {}, s = {};
    resp.atividades.forEach((a, i) => { c[a] = CORES[i % CORES.length]; s[a] = gerarSigla(a); });
    return { corMap: c, siglaMap: s };
  }, [resp.atividades]);

  const temReplan = resp.segmentos.some(s => s.replanejado);

  const handleDrop = useCallback((info) => {
    if (!podeReplanejar) { alert('Apenas gestor/admin podem replanejar.'); return; }
    setReplanData(info);
  }, [podeReplanejar]);

  async function resetar() {
    if (!confirm('Voltar toda a Linha de Balanço à linha de base? Os replanejamentos serão desfeitos.')) return;
    const { data } = await api.post('/lb/replanejar/reset', {});
    setResp(data);
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Linha de Balanço</h1>
          {!loading && resp.segmentos.length > 0 && (() => {
            const nFases = resp.pavimentos.filter(p => FASES_EDIFICIO.includes(p)).length;
            const nPav = resp.pavimentos.length - nFases;
            const anoIni = resp.periodo.inicio?.slice(0, 4);
            const anoFim = resp.periodo.fim?.slice(0, 4);
            return (
              <p className="text-slate-500 text-sm mt-0.5">
                {resp.atividades.length} atividades · {nPav} pavimentos + {nFases} fases · {fmtBR(resp.periodo.inicio)}/{anoIni?.slice(2)} a {fmtBR(resp.periodo.fim)}/{anoFim?.slice(2)}
              </p>
            );
          })()}
        </div>
        <div className="flex items-center gap-2">
          {podeReplanejar && temReplan && (
            <button onClick={resetar} className="btn-secondary flex items-center gap-2 text-sm">
              <RotateCcw size={15} /> Linha de base
            </button>
          )}
          {podeEditar && (
            <button onClick={() => setLancamento(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Lançamento
            </button>
          )}
        </div>
      </div>

      {podeReplanejar && !loading && resp.segmentos.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-800 flex items-center gap-2">
          <Move size={15} /> <strong>Arraste</strong> uma barra para replanejar (mover para outra semana). <strong>Clique</strong> para ver o histograma de ciclo. O contorno tracejado mostra a linha de base.
        </div>
      )}

      {loading && <div className="card text-center py-16 text-slate-400">Carregando...</div>}

      {!loading && resp.segmentos.length === 0 && (
        <div className="card text-center py-16">
          <p className="text-slate-500">Nenhum dado de Linha de Balanço.</p>
          <p className="text-slate-400 text-sm mt-1">Importe o Cronograma primeiro.</p>
        </div>
      )}

      {!loading && resp.segmentos.length > 0 && (
        <>
          {/* Legenda */}
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {resp.atividades.map(a => (
              <button key={a} onClick={() => setSelecionada(a === selecionada ? null : a)}
                className={`flex items-center gap-1.5 text-xs hover:text-slate-900 ${selecionada === a ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>
                <span className="inline-flex items-center justify-center w-7 h-4 rounded text-[9px] font-bold text-white"
                  style={{ backgroundColor: corMap[a] }}>{siglaMap[a]}</span>{a}
              </button>
            ))}
          </div>

          <div className="card p-3">
            <TimelineLB
              segmentos={resp.segmentos} pavimentos={resp.pavimentos} periodo={resp.periodo}
              corMap={corMap} siglaMap={siglaMap}
              onDrop={handleDrop}
              onSelect={a => setSelecionada(x => x === a ? null : a)}
              selecionada={selecionada}
            />
          </div>

          {selecionada && <HistogramaCiclo atividade={selecionada} onFechar={() => setSelecionada(null)} />}
        </>
      )}

      {replanData && (
        <ModalReplan dados={replanData} corMap={corMap}
          onFechar={() => setReplanData(null)}
          onConfirmado={(data) => { setResp(data); setReplanData(null); }} />
      )}

      {lancamento && (
        <ModalLancamento
          opcoes={{ atividades: resp.atividades, pavimentos: resp.pavimentos }}
          onFechar={() => setLancamento(false)}
          onSalvo={() => { setLancamento(false); carregar(); }} />
      )}
    </div>
  );
}
