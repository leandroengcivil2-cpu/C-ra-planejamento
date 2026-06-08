const express = require('express');
const jwt = require('jsonwebtoken');
const { getOne } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Login simples (MVP): senha fixa "admin123" para os usuários iniciais.
// TODO: substituir por bcrypt.compare(senha, user.senha_hash)
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    const user = await getOne('SELECT * FROM users WHERE email = $1 AND ativo = 1', [email]);

    if (!user || senha !== 'admin123') {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '8h' }
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
