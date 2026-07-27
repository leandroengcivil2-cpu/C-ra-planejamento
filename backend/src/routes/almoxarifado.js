const express = require('express');
const { getOne, getAll, query, tx } = require('../db');
const { authMiddleware, requirePerfil } = require('../middleware/auth');

const router = express.Router();

const ESCRITA = ['gestor', 'admin', 'almoxarife'];
const PLANEJAMENTO = ['gestor', 'admin', 'engenheiro'];

// SELECT de insumo com estoque atual calculado das movimentações
const SELECT_INSUMO = `
  SELECT i.*,
    COALESCE((
      SELECT SUM(CASE WHEN m.tipo = 'saida' THEN -m.quantidade ELSE m.quantidade END)
      FROM estoque_mov m WHERE m.insumo_id = i.id
    ), 0) AS estoque_atual
  FROM insumos i
`;

// ── INSUMOS ──────────────────────────────────────────────────────────────────

router.get('/insumos', authMiddleware, async (req, res) => {
  try {
    const insumos = await getAll(`${SELECT_INSUMO} WHERE i.ativo = 1 ORDER BY i.descricao ASC`);
    res.json(insumos);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/insumos', authMiddleware, requirePerfil(...ESCRITA), async (req, res) => {
  const descricao = (req.body.descricao || '').trim();
  const unidade = (req.body.unidade || '').trim();
  if (!descricao || !unidade) return res.status(400).json({ error: 'Descrição e unidade são obrigatórias' });
  try {
    const r = await query(
      `INSERT INTO insumos (codigo, descricao, unidade, categoria, estoque_minimo)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.body.codigo || null, descricao, unidade, req.body.categoria || null, parseFloat(req.body.estoque_minimo) || 0]
    );
    res.json({ ...r.rows[0], estoque_atual: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/insumos/:id', authMiddleware, requirePerfil(...ESCRITA), async (req, res) => {
  const id = parseInt(req.params.id);
  const { codigo, descricao, unidade, categoria, estoque_minimo, ativo } = req.body;
  try {
    const r = await query(
      `UPDATE insumos SET
         codigo = COALESCE($1, codigo),
         descricao = COALESCE($2, descricao),
         unidade = COALESCE($3, unidade),
         categoria = COALESCE($4, categoria),
         estoque_minimo = COALESCE($5, estoque_minimo),
         ativo = COALESCE($6, ativo)
       WHERE id = $7 RETURNING *`,
      [codigo ?? null, descricao ?? null, unidade ?? null, categoria ?? null,
       estoque_minimo ?? null, ativo ?? null, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Insumo não encontrado' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Entrada / ajuste de estoque
router.post('/insumos/:id/movimento', authMiddleware, requirePerfil(...ESCRITA), async (req, res) => {
  const id = parseInt(req.params.id);
  const tipo = req.body.tipo === 'ajuste' ? 'ajuste' : 'entrada';
  const quantidade = parseFloat(req.body.quantidade);
  if (!quantidade || quantidade <= 0) return res.status(400).json({ error: 'Quantidade inválida' });
  try {
    await query(
      `INSERT INTO estoque_mov (insumo_id, tipo, quantidade, data, motivo, usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, tipo, quantidade, req.body.data || new Date().toISOString().slice(0, 10),
       req.body.motivo || (tipo === 'entrada' ? 'Recebimento' : 'Ajuste'), req.user.id]
    );
    const insumo = await getOne(`${SELECT_INSUMO} WHERE i.id = $1`, [id]);
    res.json(insumo);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Alertas de estoque abaixo do mínimo
router.get('/alertas', authMiddleware, async (req, res) => {
  try {
    const todos = await getAll(`${SELECT_INSUMO} WHERE i.ativo = 1`);
    const abaixo = todos.filter(i => i.estoque_minimo > 0 && i.estoque_atual < i.estoque_minimo);
    res.json(abaixo);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PLANO DE CONSUMO PREVISTO (por atividade, por pavimento) ──────────────────

router.get('/plano', authMiddleware, async (req, res) => {
  try {
    const { atividade } = req.query;
    let q = `
      SELECT p.*, i.descricao, i.unidade, i.codigo
      FROM plano_insumo p JOIN insumos i ON p.insumo_id = i.id
    `;
    const params = [];
    if (atividade) { q += ' WHERE p.atividade = $1'; params.push(atividade); }
    q += ' ORDER BY p.atividade, i.descricao';
    res.json(await getAll(q, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/plano', authMiddleware, requirePerfil(...PLANEJAMENTO), async (req, res) => {
  const { atividade, insumo_id, qtd_por_pavimento } = req.body;
  if (!atividade || !insumo_id) return res.status(400).json({ error: 'atividade e insumo são obrigatórios' });
  try {
    await query(
      `INSERT INTO plano_insumo (atividade, insumo_id, qtd_por_pavimento)
       VALUES ($1,$2,$3)
       ON CONFLICT (atividade, insumo_id) DO UPDATE SET qtd_por_pavimento = EXCLUDED.qtd_por_pavimento`,
      [atividade, insumo_id, parseFloat(qtd_por_pavimento) || 0]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/plano/:id', authMiddleware, requirePerfil(...PLANEJAMENTO), async (req, res) => {
  try {
    await query('DELETE FROM plano_insumo WHERE id = $1', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── FICHAS DE RETIRADA ────────────────────────────────────────────────────────

router.get('/fichas', authMiddleware, async (req, res) => {
  try {
    const { pavimento, atividade } = req.query;
    let q = `
      SELECT f.*, u.nome AS usuario_nome,
        (SELECT COUNT(*) FROM ficha_itens WHERE ficha_id = f.id) AS num_itens
      FROM fichas_retirada f LEFT JOIN users u ON f.usuario_id = u.id
      WHERE 1=1
    `;
    const params = []; let i = 1;
    if (pavimento) { q += ` AND f.pavimento = $${i++}`; params.push(pavimento); }
    if (atividade) { q += ` AND f.atividade = $${i++}`; params.push(atividade); }
    q += ' ORDER BY f.data DESC, f.id DESC LIMIT 200';
    res.json(await getAll(q, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/fichas/:id', authMiddleware, async (req, res) => {
  try {
    const ficha = await getOne('SELECT * FROM fichas_retirada WHERE id = $1', [parseInt(req.params.id)]);
    if (!ficha) return res.status(404).json({ error: 'Ficha não encontrada' });
    const itens = await getAll(`
      SELECT fi.*, i.descricao, i.unidade, i.codigo
      FROM ficha_itens fi JOIN insumos i ON fi.insumo_id = i.id
      WHERE fi.ficha_id = $1 ORDER BY i.descricao
    `, [ficha.id]);
    res.json({ ...ficha, itens });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cria uma ficha de retirada e dá baixa no estoque (uma saída por item).
router.post('/fichas', authMiddleware, requirePerfil(...ESCRITA), async (req, res) => {
  const { data, pavimento, atividade, responsavel, observacao, itens } = req.body;
  if (!pavimento || !atividade || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'pavimento, atividade e ao menos 1 item são obrigatórios' });
  }
  const validos = itens.filter(it => it.insumo_id && parseFloat(it.quantidade) > 0);
  if (!validos.length) return res.status(400).json({ error: 'Informe quantidade para ao menos 1 item' });

  try {
    const fichaId = await tx(async (client) => {
      const f = await client.query(
        `INSERT INTO fichas_retirada (data, pavimento, atividade, responsavel, observacao, usuario_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [data || new Date().toISOString().slice(0, 10), pavimento, atividade,
         responsavel || null, observacao || null, req.user.id]
      );
      const fid = f.rows[0].id;
      for (const it of validos) {
        const qtd = parseFloat(it.quantidade);
        await client.query(
          `INSERT INTO ficha_itens (ficha_id, insumo_id, quantidade) VALUES ($1,$2,$3)`,
          [fid, it.insumo_id, qtd]
        );
        await client.query(
          `INSERT INTO estoque_mov (insumo_id, tipo, quantidade, data, ficha_id, motivo, usuario_id)
           VALUES ($1,'saida',$2,$3,$4,$5,$6)`,
          [it.insumo_id, qtd, data || new Date().toISOString().slice(0, 10), fid,
           `Retirada ${pavimento}/${atividade}`, req.user.id]
        );
      }
      return fid;
    });
    res.json({ ok: true, ficha_id: fichaId });
  } catch (e) { res.status(500).json({ error: 'Erro ao salvar ficha: ' + e.message }); }
});

// ── APROPRIAÇÃO: previsto x realizado por pavimento/atividade ─────────────────

router.get('/apropriacao', authMiddleware, async (req, res) => {
  const { pavimento, atividade } = req.query;
  if (!atividade) return res.status(400).json({ error: 'atividade é obrigatória' });
  try {
    // Previsto (por pavimento) para a atividade
    const previsto = await getAll(`
      SELECT p.insumo_id, p.qtd_por_pavimento, i.descricao, i.unidade, i.codigo
      FROM plano_insumo p JOIN insumos i ON p.insumo_id = i.id
      WHERE p.atividade = $1
    `, [atividade]);

    // Realizado (retirado) para atividade + pavimento (se informado)
    let q = `
      SELECT fi.insumo_id, SUM(fi.quantidade) AS retirado
      FROM ficha_itens fi JOIN fichas_retirada f ON fi.ficha_id = f.id
      WHERE f.atividade = $1
    `;
    const params = [atividade]; let i = 2;
    if (pavimento) { q += ` AND f.pavimento = $${i++}`; params.push(pavimento); }
    q += ' GROUP BY fi.insumo_id';
    const realizadoRows = await getAll(q, params);
    const realMap = {};
    for (const r of realizadoRows) realMap[r.insumo_id] = Number(r.retirado);

    // Junta previsto + realizado por insumo
    const mapa = {};
    for (const p of previsto) {
      mapa[p.insumo_id] = {
        insumo_id: p.insumo_id, descricao: p.descricao, unidade: p.unidade, codigo: p.codigo,
        previsto: Number(p.qtd_por_pavimento), retirado: realMap[p.insumo_id] || 0
      };
    }
    // Insumos retirados sem previsão
    for (const r of realizadoRows) {
      if (!mapa[r.insumo_id]) {
        const ins = await getOne('SELECT descricao, unidade, codigo FROM insumos WHERE id = $1', [r.insumo_id]);
        mapa[r.insumo_id] = {
          insumo_id: r.insumo_id, descricao: ins?.descricao, unidade: ins?.unidade, codigo: ins?.codigo,
          previsto: 0, retirado: Number(r.retirado)
        };
      }
    }
    const linhas = Object.values(mapa).map(l => ({
      ...l, saldo: l.previsto - l.retirado,
      pct: l.previsto > 0 ? l.retirado / l.previsto : null
    }));

    res.json({ atividade, pavimento: pavimento || null, linhas });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
