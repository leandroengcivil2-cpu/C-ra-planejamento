const express = require('express');
const { getOne, getAll } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const ORCAMENTO_OBRA = 47323083;
const ORCAMENTO_AC = 2545723;
const ORCAMENTO_TOTAL = ORCAMENTO_OBRA + ORCAMENTO_AC;

/**
 * GET /api/dashboard
 * Indicadores físico-financeiros da versão vigente do cronograma.
 * Query params: visao = 'obra' | 'areas_comuns' | 'total' (default: total)
 */
router.get('/', authMiddleware, async (req, res) => {
  const visao = req.query.visao || 'total';

  try {
    const versao = await getOne(`
      SELECT * FROM cronograma_versoes WHERE tipo = 'linha_base' AND ativa = 1 ORDER BY id DESC LIMIT 1
    `);

    if (!versao) {
      return res.json({ sem_dados: true, mensagem: 'Nenhum cronograma importado ainda' });
    }

    const raiz = await getOne(`
      SELECT pct_prevista, pct_concluida, inicio_lb, termino_lb, inicio, termino
      FROM tarefas
      WHERE versao_id = $1 AND nivel = 1
      ORDER BY id ASC LIMIT 1
    `, [versao.id]);

    const pctPrevista = raiz?.pct_prevista || 0;
    const pctConcluida = raiz?.pct_concluida || 0;

    const orcamento = visao === 'obra' ? ORCAMENTO_OBRA
      : visao === 'areas_comuns' ? ORCAMENTO_AC
      : ORCAMENTO_TOTAL;

    const va = pctConcluida * orcamento;
    const cp = pctPrevista * orcamento;
    const idp = cp > 0 ? va / cp : null;
    const vp = va - cp;

    let semaforoIdp = 'verde';
    if (idp === null) semaforoIdp = 'cinza';
    else if (idp < 0.85) semaforoIdp = 'vermelho';
    else if (idp < 1.0) semaforoIdp = 'amarelo';

    const curvaS = await buildCurvaS(versao.id);

    res.json({
      versao: { id: versao.id, nome: versao.nome, data_importacao: versao.data_importacao },
      visao,
      orcamento,
      pct_prevista: pctPrevista,
      pct_concluida: pctConcluida,
      va, cp, idp, vp,
      semaforo_idp: semaforoIdp,
      curva_s: curvaS,
      datas: {
        inicio_lb: raiz?.inicio_lb,
        termino_lb: raiz?.termino_lb,
        inicio_real: raiz?.inicio,
        termino_real: raiz?.termino
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function buildCurvaS(versaoId) {
  const tarefas = await getAll(`
    SELECT edt, pct_prevista, pct_concluida, termino_lb, termino, nivel
    FROM tarefas
    WHERE versao_id = $1 AND nivel >= 2 AND pacote = 'ATIVIDADE'
    ORDER BY termino_lb ASC
  `, [versaoId]);

  if (!tarefas.length) return [];

  const meses = {};
  for (const t of tarefas) {
    const mesLb = t.termino_lb ? t.termino_lb.slice(0, 7) : null;
    if (!mesLb) continue;
    if (!meses[mesLb]) meses[mesLb] = { mes: mesLb, tarefas: [] };
    meses[mesLb].tarefas.push(t);
  }

  const pontos = Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes));

  let acumPrevista = 0;
  let acumConcluida = 0;

  return pontos.map(({ mes, tarefas: ts }) => {
    const mediaPrevista = ts.reduce((s, t) => s + t.pct_prevista, 0) / ts.length;
    const mediaConcluida = ts.reduce((s, t) => s + t.pct_concluida, 0) / ts.length;
    acumPrevista += mediaPrevista / pontos.length;
    acumConcluida += mediaConcluida / pontos.length;

    return {
      mes,
      pct_prevista_mes: mediaPrevista,
      pct_concluida_mes: mediaConcluida,
      pct_prevista_acum: Math.min(acumPrevista, 1),
      pct_concluida_acum: Math.min(acumConcluida, 1),
      cp_acum: Math.min(acumPrevista, 1) * ORCAMENTO_TOTAL,
      va_acum: Math.min(acumConcluida, 1) * ORCAMENTO_TOTAL
    };
  });
}

module.exports = router;
