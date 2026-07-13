const express = require('express');
const { getOne, getAll, query } = require('../db');
const { authMiddleware, requirePerfil } = require('../middleware/auth');

const router = express.Router();

const STATUS_VALIDOS = ['a_contratar', 'em_cotacao', 'em_negociacao', 'contratado'];

/**
 * GET /api/contratacoes/eap
 * Grupos do orçamento (nível 2) para vincular a contratação a um código EAP.
 */
router.get('/eap', authMiddleware, async (req, res) => {
  try {
    const grupos = [];
    for (const tipo of ['obra', 'areas_comuns']) {
      const versao = await getOne(
        `SELECT id FROM orcamento_versoes WHERE tipo = $1 ORDER BY id DESC LIMIT 1`, [tipo]
      );
      if (!versao) continue;

      const itens = await getAll(`
        SELECT codigo, descricao, total
        FROM orcamento_itens
        WHERE versao_id = $1 AND nivel = 2
        ORDER BY codigo ASC
      `, [versao.id]);

      grupos.push(...itens.map(it => ({
        codigo: it.codigo,
        descricao: it.descricao,
        valor_orcado: it.total,
        tipo_orcamento: tipo
      })));
    }
    res.json(grupos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/contratacoes
 * Lista as contratações + resumo (KPIs). Filtro opcional: status.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;

    let q = `
      SELECT c.*, u.nome AS usuario_nome
      FROM contratacoes c
      LEFT JOIN users u ON c.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (status && STATUS_VALIDOS.includes(status)) {
      q += ` AND c.status = $1`;
      params.push(status);
    }
    q += ` ORDER BY
      CASE c.status
        WHEN 'a_contratar' THEN 0
        WHEN 'em_cotacao' THEN 1
        WHEN 'em_negociacao' THEN 2
        WHEN 'contratado' THEN 3
      END,
      c.data_limite ASC NULLS LAST, c.id DESC`;

    const itens = (await getAll(q, params)).map(c => {
      const economia = (c.status === 'contratado' && c.valor_contratado != null)
        ? (c.valor_orcado || 0) - c.valor_contratado
        : null;
      return { ...c, economia };
    });

    // Resumo sobre o conjunto completo (ignora filtro de status).
    const todos = await getAll(`SELECT status, valor_orcado, valor_contratado FROM contratacoes`);
    const resumo = {
      total: todos.length,
      por_status: { a_contratar: 0, em_cotacao: 0, em_negociacao: 0, contratado: 0 },
      valor_orcado_total: 0,
      valor_contratado_total: 0,
      economia_total: 0,
      valor_pendente: 0 // orçado das que ainda não foram contratadas
    };
    for (const c of todos) {
      resumo.por_status[c.status] = (resumo.por_status[c.status] || 0) + 1;
      resumo.valor_orcado_total += c.valor_orcado || 0;
      if (c.status === 'contratado' && c.valor_contratado != null) {
        resumo.valor_contratado_total += c.valor_contratado;
        resumo.economia_total += (c.valor_orcado || 0) - c.valor_contratado;
      } else {
        resumo.valor_pendente += c.valor_orcado || 0;
      }
    }

    res.json({ itens, resumo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/contratacoes — cria uma contratação
 */
router.post('/', authMiddleware, requirePerfil('gestor', 'admin'), async (req, res) => {
  const {
    descricao, codigo_eap, descricao_eap, tipo_orcamento, valor_orcado,
    status, responsavel, data_limite, fornecedor, valor_contratado, observacao
  } = req.body;

  if (!descricao || !descricao.trim()) {
    return res.status(400).json({ error: 'A descrição é obrigatória' });
  }
  const st = status && STATUS_VALIDOS.includes(status) ? status : 'a_contratar';

  try {
    const r = await getOne(`
      INSERT INTO contratacoes
        (descricao, codigo_eap, descricao_eap, tipo_orcamento, valor_orcado,
         status, responsavel, data_limite, fornecedor, valor_contratado, observacao, usuario_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [
      descricao.trim(), codigo_eap || null, descricao_eap || null,
      tipo_orcamento || null, valor_orcado || 0, st,
      responsavel || null, data_limite || null, fornecedor || null,
      valor_contratado != null && valor_contratado !== '' ? valor_contratado : null,
      observacao || null, req.user.id
    ]);
    res.json({ ok: true, contratacao: r });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /api/contratacoes/:id — atualiza
 */
router.put('/:id', authMiddleware, requirePerfil('gestor', 'admin'), async (req, res) => {
  const { id } = req.params;
  const {
    descricao, codigo_eap, descricao_eap, tipo_orcamento, valor_orcado,
    status, responsavel, data_limite, fornecedor, valor_contratado, observacao
  } = req.body;

  if (!descricao || !descricao.trim()) {
    return res.status(400).json({ error: 'A descrição é obrigatória' });
  }
  if (status && !STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  try {
    const r = await getOne(`
      UPDATE contratacoes SET
        descricao = $1, codigo_eap = $2, descricao_eap = $3, tipo_orcamento = $4,
        valor_orcado = $5, status = $6, responsavel = $7, data_limite = $8,
        fornecedor = $9, valor_contratado = $10, observacao = $11, atualizado_em = NOW()
      WHERE id = $12
      RETURNING *
    `, [
      descricao.trim(), codigo_eap || null, descricao_eap || null, tipo_orcamento || null,
      valor_orcado || 0, status || 'a_contratar', responsavel || null, data_limite || null,
      fornecedor || null,
      valor_contratado != null && valor_contratado !== '' ? valor_contratado : null,
      observacao || null, id
    ]);
    if (!r) return res.status(404).json({ error: 'Contratação não encontrada' });
    res.json({ ok: true, contratacao: r });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /api/contratacoes/:id
 */
router.delete('/:id', authMiddleware, requirePerfil('gestor', 'admin'), async (req, res) => {
  try {
    await query(`DELETE FROM contratacoes WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
