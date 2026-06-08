const express = require('express');
const jwt = require('jsonwebtoken');
const { getOne } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Login por e-mail (whitelist): só entra quem está cadastrado e ativo.
// Sem senha — acesso para equipe interna confiável.
router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Informe o e-mail' });
  }

  try {
    const user = await getOne('SELECT * FROM users WHERE LOWER(email) = $1 AND ativo = 1', [email]);

    if (!user) {
      return res.status(401).json({ error: 'E-mail não cadastrado. Peça ao gestor para liberar seu acesso.' });
    }

    const token = jwt.sign(
      { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
