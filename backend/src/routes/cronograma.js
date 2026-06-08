const express = require('express');
const { getOne, getAll } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

async function versaoAtiva() {
  return getOne(
    `SELECT id FROM cronograma_versoes WHERE tipo = 'linha_base' AND ativa = 1 ORDER BY id DESC LIMIT 1`
  );
}

/**
 * GET /api/cronograma/tarefas
 * Filtros: pacote, critica, pavimento, nivel_max
 */
router.get('/tarefas', authMiddleware, async (req, res) => {
  try {
    const { pacote, critica, pavimento, nivel_max } = req.query;
    const versao = await versaoAtiva();
    if (!versao) return res.json([]);

    let q = `SELECT * FROM tarefas WHERE versao_id = $1`;
    const params = [versao.id];
    let i = 2;

    if (pacote) { q += ` AND pacote = $${i++}`; params.push(pacote.toUpperCase()); }
    if (critica) { q += ` AND critica = $${i++}`; params.push(critica === 'true' ? 1 : 0); }
    if (pavimento) { q += ` AND pavimento ILIKE $${i++}`; params.push(`%${pavimento}%`); }
    if (nivel_max) { q += ` AND nivel <= $${i++}`; params.push(parseInt(nivel_max)); }

    q += ' ORDER BY edt ASC';

    res.json(await getAll(q, params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/cronograma/versoes
 */
router.get('/versoes', authMiddleware, async (req, res) => {
  try {
    const versoes = await getAll(`
      SELECT v.*, u.nome as usuario_nome,
             (SELECT COUNT(*) FROM tarefas WHERE versao_id = v.id) as total_tarefas
      FROM cronograma_versoes v
      LEFT JOIN users u ON v.usuario_id = u.id
      ORDER BY v.id DESC
    `);
    res.json(versoes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/cronograma/resumo-pavimento
 */
router.get('/resumo-pavimento', authMiddleware, async (req, res) => {
  try {
    const versao = await versaoAtiva();
    if (!versao) return res.json([]);

    const dados = await getAll(`
      SELECT pavimento,
             AVG(pct_prevista) as pct_prevista_media,
             AVG(pct_concluida) as pct_concluida_media,
             COUNT(*) as total_tarefas,
             SUM(CASE WHEN pct_concluida >= 1 THEN 1 ELSE 0 END) as concluidas
      FROM tarefas
      WHERE versao_id = $1 AND pavimento IS NOT NULL AND pavimento <> '' AND pacote = 'ATIVIDADE'
      GROUP BY pavimento
      ORDER BY pavimento
    `, [versao.id]);

    res.json(dados);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
