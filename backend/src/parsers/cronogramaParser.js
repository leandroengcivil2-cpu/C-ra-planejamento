/**
 * Parser do Cronograma Corá.xlsm
 *
 * Estrutura da aba CRONOGRAMA:
 *   - Cabeçalhos na linha 5 (índice 4)
 *   - Dados a partir da linha 6 (índice 5)
 *   - Colunas: B=EDT, C=Nome, D=Crítica, E=Origem, F=PACOTE, G=PAVIMENTO,
 *              H=LINHA DE BALANÇO, I=Início LB, J=Término LB, K=Início,
 *              L=Término, M=Porcentagem Prevista, N=% concluída, T=Desvio dias
 *
 * Datas: seriais numéricos do Excel (base 1899-12-30)
 */

const XLSX = require('xlsx');

const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30));

function excelDateToISO(serial) {
  if (!serial || isNaN(serial)) return null;
  const ms = Math.round(serial) * 86400 * 1000;
  const date = new Date(EXCEL_EPOCH.getTime() + ms);
  return date.toISOString().split('T')[0];
}

function calcNivel(edt) {
  if (!edt) return 1;
  return edt.toString().split('.').length;
}

/**
 * @param {Buffer} buffer  — conteúdo do arquivo .xlsm
 * @returns {{ tarefas: Array, linhaBalanco: Array }}
 */
function parseCronograma(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  const tarefas = parseCronogramaSheet(workbook);
  // A Linha de Balanço real (31 pavimentos) vem das tarefas do cronograma,
  // não da aba "LINHA DE BALANÇO" (que está simplificada com 13 pavimentos).
  const linhaBalanco = parseLbFromTasks(tarefas);

  return { tarefas, linhaBalanco };
}

function parseCronogramaSheet(workbook) {
  const sheetName = workbook.SheetNames.find(n => n === 'CRONOGRAMA') || workbook.SheetNames[1];
  const ws = workbook.Sheets[sheetName];

  if (!ws) throw new Error('Aba CRONOGRAMA não encontrada');

  // Converte para array de arrays (raw)
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
    range: 4  // começa na linha 5 (índice 4) — linha de cabeçalho
  });

  // rows[0] = cabeçalhos, rows[1..] = dados
  const tarefas = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue; // col B (índice 0 após range)

    const edt = String(row[0] || '').trim();
    const nome = String(row[1] || '').trim();

    if (!edt || !nome) continue;

    // Ignora linhas de cabeçalho repetidas
    if (edt === 'EDT') continue;

    const critica = String(row[2] || '').toLowerCase().includes('sim') ? 1 : 0;
    const origem = String(row[3] || '').trim();
    const pacote = String(row[4] || '').trim();
    const pavimento = String(row[5] || '').trim();
    const linhaBalanco = String(row[6] || '').trim();

    const inicioLb = excelDateToISO(row[7]);
    const terminoLb = excelDateToISO(row[8]);
    const inicio = excelDateToISO(row[9]);
    const termino = excelDateToISO(row[10]);

    const pctPrevista = parseFloat(row[11]) || 0;
    const pctConcluida = parseFloat(row[12]) || 0;

    // Colunas S1-S5 são índices 13-17, DESVIO EM DIAS = índice 18
    const desvioDias = parseInt(row[18]) || 0;

    tarefas.push({
      edt,
      nome,
      critica,
      origem,
      pacote,
      pavimento,
      linha_balanco: linhaBalanco || null,
      inicio_lb: inicioLb,
      termino_lb: terminoLb,
      inicio,
      termino,
      pct_prevista: pctPrevista,
      pct_concluida: pctConcluida,
      desvio_dias: desvioDias,
      nivel: calcNivel(edt)
    });
  }

  return tarefas;
}

// ── Linha de Balanço a partir das tarefas do cronograma ──────────────────────

// Normaliza texto para comparação (minúsculo, sem acento, espaços colapsados)
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// Extrai o pavimento do sufixo "... - <Pavimento>" e devolve o nome canônico.
function extrairPavimento(nome) {
  const n = norm(nome);
  // 1º a 22º Pavimento
  let m = n.match(/-\s*(\d{1,2})\s*[ºo]?\s*pav(?:imento)?\s*$/);
  if (m) return `${parseInt(m[1])}º Pav`;
  if (/-\s*terreo\s*$/.test(n)) return 'Térreo';
  if (/-\s*mezanino\s*$/.test(n)) return 'Mezanino';
  m = n.match(/-\s*sob\.?\s*([123])\s*$/); if (m) return `Sob ${m[1]}`;
  if (/-\s*lazer\s*$/.test(n)) return 'Lazer';
  if (/-\s*dup(?:lex)?\.?\s*(inferior|inf)\.?\s*$/.test(n)) return 'Duplex Inferior';
  if (/-\s*dup(?:lex)?\.?\s*(superior|sup)\.?\s*$/.test(n)) return 'Duplex Superior';
  if (/-\s*cobertura\s*$/.test(n)) return 'Cobertura';
  return null;
}

// Atividades PRINCIPAIS por-pavimento (lista definida pelo gestor).
// Ordem específica → genérica (drywall antes das não-drywall). Retorna o rótulo
// limpo ou null (atividades fora da lista são ignoradas na LB).
const MAPA_ATIVIDADE = [
  // Forro (contém "plaqueamento de forro" — precisa vir antes do plaqueamento)
  [n => n.includes('forro'), 'Forro'],
  // Drywall (específicas primeiro)
  [n => n.includes('hidrossanitaria') && n.includes('drywall'), 'Instalação Hidrossanitária Drywall'],
  [n => n.includes('eletrica') && n.includes('drywall'), 'Instalação Elétrica Drywall'],
  [n => n.includes('ar condicionado') && n.includes('drywall'), 'Ar Condicionado Drywall'],
  [n => n.includes('tratamento de junta'), 'Drywall Plaqueamento'],
  [n => n.includes('estrutura de divisoria de drywall'), 'Drywall Estrutura'],
  // Estrutura / vedação
  [n => n.includes('armadura') && n.includes('concretagem'), 'Estrutura'],
  [n => n.includes('vedacao bloco') || (n.includes('bloco ceramico') && n.includes('bloco de concreto')), 'Alvenaria'],
  [n => n.includes('churrasqueira') || n.includes('dumper'), 'Churrasqueira'],
  // Instalações 1ª onda
  [n => n.includes('tubulacoes de agua'), 'Instalação Hidráulica 1'],
  [n => n.includes('distribuicao teto'), 'Instalação Elétrica 1'],
  [n => n.includes('dados e voz'), 'Comunicação'],
  [n => n.includes('ramais de gas'), 'Gás'],
  // Acabamento bruto
  [n => n.startsWith('emboco'), 'Emboço Interno'],
  [n => n.includes('contrapiso'), 'Contrapiso'],
  [n => n.includes('impermeabilizacao'), 'Impermeabilização'],
  [n => n.includes('revestimento ceramico'), 'Revestimento Cerâmico'],
  [n => n.includes('cabeamento'), 'Cabeamento'],
  [n => n.includes('forro em drywall'), 'Forro'],
  // Pintura / acabamento fino
  [n => n.includes('emassamento'), 'Emassamento'],
  [n => n.includes('pintura') && n.includes('1'), 'Pintura 1ª Demão'],
  [n => n.includes('pintura') && n.includes('2'), 'Pintura 2ª Demão'],
  [n => n.includes('limpeza grossa'), 'Limpeza Grossa'],
  [n => n.includes('loucas') || n.includes('bancadas de granito'), 'Louças'],
  [n => n.includes('metais'), 'Metais'],
  [n => n.includes('acabamentos de tomada'), 'Acabamentos Elétrico'],
  [n => n.includes('portas de madeira'), 'Portas de Madeira'],
  [n => n.includes('piso vinilico'), 'Piso Vinílico'],
  [n => n.includes('limpeza fina'), 'Limpeza Fina'],
  [n => n.includes('vistoria'), 'Vistoria Interna']
];

function mapearAtividade(nome) {
  const n = norm(nome);
  for (const [teste, limpo] of MAPA_ATIVIDADE) {
    if (teste(n)) return limpo;
  }
  return null;
}

// Fases do edifício (não são por-pavimento): rótulo → EDT do grupo no cronograma.
// Cada uma vira uma "faixa" própria no rodapé da grade.
const FASES_EDIFICIO = [
  { edt: '1.2.2', label: 'Fundação' },
  { edt: '1.3.13.1', label: 'Fachada 1ª Metade' },
  { edt: '1.3.13.2', label: 'Fachada 2ª Metade' },
  { edt: '1.3.13.2.7', label: 'Esquadria de Alumínio' },
  { edt: '1.3.14', label: 'Elevador' }
];

// Gera datas de dias úteis (seg-sex) entre inicio e fim (ISO), inclusive.
function diasUteis(inicioISO, fimISO) {
  const out = [];
  const d = new Date(inicioISO + 'T00:00:00');
  const fim = new Date(fimISO + 'T00:00:00');
  let guard = 0;
  while (d <= fim && guard++ < 2000) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * Constrói a Linha de Balanço (31 pavimentos) a partir das tarefas do cronograma.
 * Cada tarefa "<Atividade> - <Pavimento>" com datas de linha de base vira um
 * segmento; expandimos em dias úteis para alimentar a grade/segmentos/histograma.
 */
function parseLbFromTasks(tarefas) {
  const entries = [];

  // 1) Atividades principais por pavimento
  for (const t of tarefas) {
    if (!t.inicio_lb || !t.termino_lb) continue;
    const pavimento = extrairPavimento(t.nome);
    if (!pavimento) continue;
    const atividade = mapearAtividade(t.nome);
    if (!atividade) continue;
    for (const data of diasUteis(t.inicio_lb, t.termino_lb)) {
      entries.push({ data, pavimento, atividade });
    }
  }

  // 2) Fases do edifício (uma faixa própria, pavimento = próprio rótulo)
  const porEdt = {};
  for (const t of tarefas) porEdt[t.edt] = t;
  for (const fase of FASES_EDIFICIO) {
    const t = porEdt[fase.edt];
    if (!t || !t.inicio_lb || !t.termino_lb) continue;
    for (const data of diasUteis(t.inicio_lb, t.termino_lb)) {
      entries.push({ data, pavimento: fase.label, atividade: fase.label });
    }
  }

  return entries;
}

module.exports = { parseCronograma };
