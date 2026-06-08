const express = require('express');
const { getOne, getAll } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/orcamento/itens
 * Filtros: tipo (obra|areas_comuns|total), nivel_max, codigo_pai
 */
router.get('/itens', authMiddleware, async (req, res) => {
  try {
    const { tipo = 'total', nivel_max, codigo_pai } = req.query;
    const tiposQuery = tipo === 'total' ? ['obra', 'areas_comuns'] : [tipo];

    let resultados = [];

    for (const t of tiposQuery) {
      const versao = await getOne(
        `SELECT id FROM orcamento_versoes WHERE tipo = $1 ORDER BY id DESC LIMIT 1`, [t]
      );
      if (!versao) continue;

      let q = `SELECT * FROM orcamento_itens WHERE versao_id = $1`;
      const params = [versao.id];
      let i = 2;

      if (nivel_max) { q += ` AND nivel <= $${i++}`; params.push(parseInt(nivel_max)); }
      if (codigo_pai) { q += ` AND codigo LIKE $${i++}`; params.push(`${codigo_pai}.%`); }

      q += ' ORDER BY codigo ASC';

      const itens = await getAll(q, params);
      resultados = resultados.concat(itens.map(it => ({ ...it, tipo_orcamento: t })));
    }

    // Totaliza por tipo usando o item raiz "01" (OBRA / ÁREAS COMUNS).
    const totais = { obra: 0, areas_comuns: 0 };
    for (const item of resultados) {
      if (item.nivel === 1 && item.codigo === '01') {
        totais[item.tipo_orcamento] = item.total;
      }
    }

    res.json({
      itens: resultados,
      totais: {
        obra: totais.obra,
        areas_comuns: totais.areas_comuns,
        total: totais.obra + totais.areas_comuns
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/orcamento/grupos
 * Apenas grupos de nível 2 com totais.
 */
router.get('/grupos', authMiddleware, async (req, res) => {
  try {
    const grupos = [];

    for (const tipo of ['obra', 'areas_comuns']) {
      const versao = await getOne(
        `SELECT id FROM orcamento_versoes WHERE tipo = $1 ORDER BY id DESC LIMIT 1`, [tipo]
      );
      if (!versao) continue;

      const itens = await getAll(`
        SELECT codigo, descricao, total, pct_total
        FROM orcamento_itens
        WHERE versao_id = $1 AND nivel = 2
        ORDER BY total DESC
      `, [versao.id]);

      grupos.push(...itens.map(it => ({ ...it, tipo })));
    }

    res.json(grupos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
