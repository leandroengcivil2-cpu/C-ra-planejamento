import { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { AlertTriangle, Plus, X, ChevronDown } from 'lucide-react';

// Paleta de cores por atividade (consistente)
const CORES = [
  '#3b5fc0','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
  '#6366f1','#a3e635','#fb923c','#38bdf8','#e879f9'
];

function corAtividade(nome, mapa) {
  if (!mapa[nome]) {
    const idx = Object.keys(mapa).length % CORES.length;
    mapa[nome] = CORES[idx];
  }
  return mapa[nome];
}

// ── Gráfico LB com D3 ───────────────────────────────────────────────────────

function GraficoLB({ atividades, onClickAtividade }) {
  const svgRef = useRef(null);
  const corMapa = useRef({});

  useEffect(() => {
    if (!atividades.length || !svgRef.current) return;

    const container = svgRef.current.parentElement;
    const totalWidth = container.clientWidth || 1100;
    const margin = { top: 20, right: 30, bottom: 50, left: 130 };
    const width = totalWidth - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', totalWidth)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Coleta todos os pavimentos na ordem correta
    const pavimentosSet = new Set();
    atividades.forEach(a => a.pavimentos.forEach(p => pavimentosSet.add(p.pavimento)));
    const pavimentos = [...pavimentosSet].sort((a, b) => {
      const ordem = ['Térro','Térreo','2o Pav','3o Pav','4o Pav','5o Pav','6o Pav','7o Pav','8o Pav','Ático',
        'Fachada Frente','Fachada Fundos','Fachada Lat. Dir.','Fachada Lat. Esq'];
      return ordem.indexOf(a) - ordem.indexOf(b);
    });

    // Coleta range de datas
    let minData = Infinity, maxData = -Infinity;
    atividades.forEach(a => a.pavimentos.forEach(p => {
      if (p.planejado.inicio) { const d = new Date(p.planejado.inicio); if (d < minData) minData = d; }
      if (p.planejado.termino) { const d = new Date(p.planejado.termino); if (d > maxData) maxData = d; }
    }));

    if (minData === Infinity) return;

    const xScale = d3.scaleTime()
      .domain([new Date(minData), new Date(maxData)])
      .range([0, width]);

    const yScale = d3.scaleBand()
      .domain(pavimentos)
      .range([height, 0])
      .padding(0.2);

    // Eixos
    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.timeFormat('%b/%y')))
      .selectAll('text').attr('font-size', 11);

    svg.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text').attr('font-size', 11);

    // Grid
    svg.append('g').attr('class', 'grid')
      .call(d3.axisBottom(xScale).ticks(10).tickSize(-height).tickFormat(''))
      .attr('transform', `translate(0,${height})`)
      .selectAll('line').attr('stroke', '#f1f5f9').attr('stroke-dasharray', '3,3');

    // Linha de hoje
    const hoje = new Date();
    if (hoje >= minData && hoje <= maxData) {
      svg.append('line')
        .attr('x1', xScale(hoje)).attr('x2', xScale(hoje))
        .attr('y1', 0).attr('y2', height)
        .attr('stroke', '#ef4444').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,3');
      svg.append('text')
        .attr('x', xScale(hoje) + 4).attr('y', 12)
        .attr('font-size', 10).attr('fill', '#ef4444')
        .text('Hoje');
    }

    // Desenha segmentos por atividade × pavimento
    atividades.forEach(ativ => {
      const cor = corAtividade(ativ.nome, corMapa.current);

      const pontosPlan = ativ.pavimentos
        .filter(p => p.planejado.inicio && p.planejado.termino)
        .map(p => ({
          x: xScale(new Date(p.planejado.inicio)) + (xScale(new Date(p.planejado.termino)) - xScale(new Date(p.planejado.inicio))) / 2,
          y: yScale(p.pavimento) + yScale.bandwidth() / 2,
          pavimento: p.pavimento
        }));

      // Linha planejada (diagonal)
      if (pontosPlan.length >= 2) {
        const linha = d3.line().x(d => d.x).y(d => d.y).curve(d3.curveLinear);
        svg.append('path')
          .datum(pontosPlan)
          .attr('d', linha)
          .attr('fill', 'none')
          .attr('stroke', cor)
          .attr('stroke-width', 2.5)
          .attr('opacity', 0.85)
          .style('cursor', 'pointer')
          .on('click', () => onClickAtividade(ativ.nome));

        // Label no meio da linha
        const mid = pontosPlan[Math.floor(pontosPlan.length / 2)];
        svg.append('text')
          .attr('x', mid.x).attr('y', mid.y - 6)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9).attr('fill', cor).attr('font-weight', '600')
          .text(ativ.nome.length > 14 ? ativ.nome.slice(0, 12) + '…' : ativ.nome);
      }

      // Linha realizada (tracejada)
      const pontosReal = ativ.pavimentos
        .filter(p => p.realizado?.inicio && p.realizado?.termino)
        .map(p => ({
          x: xScale(new Date(p.realizado.inicio)) + (xScale(new Date(p.realizado.termino)) - xScale(new Date(p.realizado.inicio))) / 2,
          y: yScale(p.pavimento) + yScale.bandwidth() / 2
        }));

      if (pontosReal.length >= 2) {
        const linha = d3.line().x(d => d.x).y(d => d.y);
        svg.append('path')
          .datum(pontosReal)
          .attr('d', linha)
          .attr('fill', 'none')
          .attr('stroke', cor)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '6,3')
          .attr('opacity', 0.6);
      }
    });

  }, [atividades]);

  return (
    <div className="overflow-x-auto">
      <svg ref={svgRef} />
    </div>
  );
}

// ── Histograma de ciclo ──────────────────────────────────────────────────────

function HistogramaCiclo({ atividade, onFechar }) {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        <button onClick={onFechar} className="text-slate-400 hover:text-slate-700">
          <X size={18} />
        </button>
      </div>

      {loading && <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>}

      {!loading && dados.length === 0 && (
        <div className="text-slate-400 text-sm py-8 text-center">Sem dados para esta atividade</div>
      )}

      {!loading && dados.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="pavimento" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 11 }} label={{ value: 'Dias', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={dados[0]?.dias_planejados} stroke="#94a3b8" strokeDasharray="5 3" label={{ value: 'Ciclo previsto', fontSize: 10 }} />
              <Bar dataKey="dias_planejados" name="Planejado" fill="#3b5fc0" opacity={0.7} radius={[4,4,0,0]} />
              <Bar dataKey="dias_reais" name="Realizado" fill="#10b981" opacity={0.85} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs text-slate-600">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-1.5 pr-3 font-semibold">Pavimento</th>
                  <th className="py-1.5 pr-3 font-semibold">Dias prev.</th>
                  <th className="py-1.5 pr-3 font-semibold">Dias reais</th>
                  <th className="py-1.5 pr-3 font-semibold">Variação</th>
                  <th className="py-1.5 font-semibold">Avanço</th>
                </tr>
              </thead>
              <tbody>
                {dados.map(d => (
                  <tr key={d.pavimento} className="border-b border-slate-50">
                    <td className="py-1.5 pr-3 font-medium">{d.pavimento}</td>
                    <td className="py-1.5 pr-3">{d.dias_planejados}</td>
                    <td className="py-1.5 pr-3">{d.dias_reais ?? '—'}</td>
                    <td className={`py-1.5 pr-3 font-medium ${d.variacao_dias > 1 ? 'text-red-600' : d.variacao_dias < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {d.variacao_dias != null ? (d.variacao_dias > 0 ? '+' : '') + d.variacao_dias + 'd' : '—'}
                    </td>
                    <td className="py-1.5">{d.pct_final != null ? (d.pct_final * 100).toFixed(0) + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Modal de lançamento de campo ─────────────────────────────────────────────

function ModalLancamento({ onFechar, onSalvo }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    data: new Date().toISOString().split('T')[0],
    pavimento: '',
    atividade: '',
    status: 'em_andamento',
    pct_avanco: '',
    observacao: ''
  });
  const [alerta, setAlerta] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Lista de atividades e pavimentos únicos
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
        ...form,
        pct_avanco: parseFloat(form.pct_avanco) / 100 || 0
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
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);

  const podeEditar = ['gestor', 'engenheiro', 'admin'].includes(user?.perfil);

  useEffect(() => {
    api.get('/lb/atividades')
      .then(r => setAtividades(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Linha de Balanço</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Visualização do ritmo de produção por atividade e pavimento
          </p>
        </div>
        {podeEditar && (
          <button onClick={() => setModalAberto(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Lançamento diário
          </button>
        )}
      </div>

      {loading && (
        <div className="card text-center py-16 text-slate-400">Carregando linha de balanço...</div>
      )}

      {!loading && atividades.length === 0 && (
        <div className="card text-center py-16">
          <p className="text-slate-500">Nenhum dado de Linha de Balanço.</p>
          <p className="text-slate-400 text-sm mt-1">Importe o Cronograma Corá.xlsm primeiro.</p>
        </div>
      )}

      {!loading && atividades.length > 0 && (
        <>
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-700">Gráfico de Linhas Diagonais</h2>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-0.5 bg-slate-500" /> Planejado
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 border-t-2 border-dashed border-slate-400" /> Realizado
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-1 h-4 bg-red-400" /> Hoje
                </span>
              </div>
            </div>
            <GraficoLB
              atividades={atividades}
              onClickAtividade={nome => setAtividadeSelecionada(nome === atividadeSelecionada ? null : nome)}
            />
            <p className="text-xs text-slate-400 mt-3">
              Clique em uma linha para ver o histograma de ciclo por pavimento.
            </p>
          </div>

          {atividadeSelecionada && (
            <HistogramaCiclo
              atividade={atividadeSelecionada}
              onFechar={() => setAtividadeSelecionada(null)}
            />
          )}
        </>
      )}

      {modalAberto && (
        <ModalLancamento
          onFechar={() => setModalAberto(false)}
          onSalvo={() => { setModalAberto(false); }}
        />
      )}
    </div>
  );
}
