/**
 * Parser do Orçamento Corá.xlsm
 *
 * Estrutura das abas ORÇAMENTO DE OBRA e ORÇAMENTO DE ÁREAS COMUNS:
 *   - Cabeçalhos na linha 3 (índice 2)
 *   - Dados a partir da linha 4 (índice 3)
 *   - Col A = código EAP (quando preenchido = item de serviço)
 *   - Col A vazia = insumo subordinado (ignorado no MVP — só itens de serviço)
 *
 * Colunas relevantes (índice 0-based após header):
 *   0=Cód. Estruturado, 1=Alternativo, 2=Insumo, 3=Descrição, 4=Unid.,
 *   5=Qtde. Serviço, 9=Custo Serviço, 10=Total, 11=Perc.(%)
 */

const XLSX = require('xlsx');

function calcNivel(codigo) {
  if (!codigo) return 1;
  // Ex: "01" → 1, "01.01" → 2, "01.01.01.001.01" → 5
  return codigo.split('.').length;
}

/**
 * @param {Buffer} buffer
 * @returns {{ obra: Array, areas_comuns: Array }}
 */
function parseOrcamento(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  const obraSheet = workbook.Sheets['ORÇAMENTO DE OBRA'];
  const acSheet = workbook.Sheets['ORÇAMENTO DE ÁREAS COMUNS'];

  return {
    obra: parseSheet(obraSheet, 'obra'),
    areas_comuns: parseSheet(acSheet, 'areas_comuns')
  };
}

function parseSheet(ws, tipo) {
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
    range: 2  // começa na linha 3 (header)
  });

  // rows[0] = cabeçalhos, rows[1..] = dados
  const itens = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const codigo = row[0] ? String(row[0]).trim() : null;

    // Só processa linhas com código EAP (ignora insumos)
    if (!codigo) continue;
    if (codigo === 'Cód. Estruturado') continue;

    const descricao = String(row[3] || '').trim();
    if (!descricao) continue;

    const alternativo = row[1] ? String(row[1]).trim() : null;
    const unidade = row[4] ? String(row[4]).trim() : null;
    const qtdeServico = parseFloat(row[5]) || null;
    const custoServico = parseFloat(row[9]) || null;
    const total = parseFloat(row[10]) || 0;
    const pctTotal = parseFloat(row[11]) || null;

    itens.push({
      tipo_orcamento: tipo,
      codigo,
      alternativo,
      descricao,
      unidade,
      qtde_servico: qtdeServico,
      custo_servico: custoServico,
      total,
      pct_total: pctTotal,
      nivel: calcNivel(codigo),
      eh_folha: 0  // será recalculado após carga completa
    });
  }

  // Marca itens folha (sem filhos)
  const codigos = new Set(itens.map(i => i.codigo));
  for (const item of itens) {
    const temFilho = itens.some(j => {
      if (j.codigo === item.codigo) return false;
      return j.codigo.startsWith(item.codigo + '.');
    });
    item.eh_folha = temFilho ? 0 : 1;
  }

  return itens;
}

module.exports = { parseOrcamento };
