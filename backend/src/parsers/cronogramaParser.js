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
  const linhaBalanco = parseLbSheet(workbook);

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

function parseLbSheet(workbook) {
  const sheetName = workbook.SheetNames.find(n => n.includes('LINHA DE BALAN')) || 'LINHA DE BALANÇO';
  const ws = workbook.Sheets[sheetName];

  if (!ws) {
    console.warn('Aba LINHA DE BALANÇO não encontrada — pulando');
    return [];
  }

  // Lê a planilha como array de arrays
  const raw = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null
  });

  /**
   * Estrutura (sheet_to_json indexa a partir da coluna B = índice 0,
   * pois a dimensão da planilha começa em B1):
   *   raw[3] (linha 4) = weekday codes
   *   raw[4] (linha 5) = seriais de data (a partir do índice 2 = coluna D)
   *   raw[5..17] = pavimentos: raw[i][1] = nome pavimento (col C),
   *                            raw[i][2..] = atividade (col D em diante)
   */

  const dateRow = raw[4];        // índice 4 = linha 5
  const pavimentoRows = raw.slice(5, 18); // linhas 6-18

  if (!dateRow) return [];

  // Extrai datas (colunas D em diante = índice 2)
  const datas = [];
  for (let c = 2; c < dateRow.length; c++) {
    const serial = dateRow[c];
    if (serial && !isNaN(serial)) {
      datas.push({ colIdx: c, iso: excelDateToISO(serial) });
    }
  }

  const lbEntries = [];

  for (const pavRow of pavimentoRows) {
    if (!pavRow) continue;
    const pavimento = String(pavRow[1] || '').trim().replace(/;$/, '');
    if (!pavimento) continue;

    for (const { colIdx, iso } of datas) {
      const atividade = pavRow[colIdx];
      if (atividade && typeof atividade === 'string' && atividade.trim()) {
        lbEntries.push({
          data: iso,
          pavimento,
          atividade: atividade.trim()
        });
      }
    }
  }

  return lbEntries;
}

module.exports = { parseCronograma };
