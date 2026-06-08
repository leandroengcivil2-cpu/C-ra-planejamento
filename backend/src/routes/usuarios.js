const express = require('express');
const { getOne, getAll, query } = require('../db');
const { authMiddleware, requirePerfil } = require('../middleware/auth');

const router = express.Router();

const PERFIS_VALIDOS = ['gestor', 'engenheiro', 'diretoria', 'admin'];

/**
 * GET /api/usuarios — lista todos (gestor/admin).
 */
router.get('/', authMiddleware, requirePerfil('gestor', 'admin'), async (req, res) => {
  try {
    const users = await getAll(
      `SELECT id, nome, email, perfil, ativo, criado_em FROM users ORDER BY ativo DESC, nome ASC`
    );
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/usuarios — cadastra novo (gestor/admin).
 * Body: { nome, email, perfil }
 */
router.post('/', authMiddleware, requirePerfil('gestor', 'admin'), async (req, res) => {
  const nome = (req.body.nome || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const perfil = (req.body.perfil || '').trim();

  if (!nome || !email) {
    return res.status(400).json({ error: 'Nome e e-mail são obrigatórios' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido' });
  }
  if (!PERFIS_VALIDOS.includes(perfil)) {
    return res.status(400).json({ error: 'Perfil inválido' });
  }

  try {
    const existe = await getOne('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (existe) {
      return res.status(409).json({ error: 'Já existe um usuário com esse e-mail' });
    }

    const r = await query(
      `INSERT INTO users (nome, email, senha_hash, perfil, ativo)
       VALUES ($1, $2, 'sem_senha', $3, 1)
       RETURNING id, nome, email, perfil, ativo, criado_em`,
      [nome, email, perfil]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /api/usuarios/:id — edita nome/perfil/ativo (gestor/admin).
 */
router.put('/:id', authMiddleware, requirePerfil('gestor', 'admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const { nome, perfil, ativo } = req.body;

  if (perfil && !PERFIS_VALIDOS.includes(perfil)) {
    return res.status(400).json({ error: 'Perfil inválido' });
  }

  try {
    const user = await getOne('SELECT * FROM users WHERE id = $1', [id]);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    // Impede o usuário de desativar a si mesmo (evita travar fora)
    if (id === req.user.id && ativo === 0) {
      return res.status(400).json({ error: 'Você não pode desativar a si mesmo' });
    }

    const r = await query(
      `UPDATE users SET
         nome = COALESCE($1, nome),
         perfil = COALESCE($2, perfil),
         ativo = COALESCE($3, ativo)
       WHERE id = $4
       RETURNING id, nome, email, perfil, ativo, criado_em`,
      [nome ?? null, perfil ?? null, ativo ?? null, id]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
