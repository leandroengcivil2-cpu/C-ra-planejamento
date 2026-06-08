require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initSchema } = require('./db');

const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const importacaoRoutes = require('./routes/importacao');
const dashboardRoutes = require('./routes/dashboard');
const lbRoutes = require('./routes/linhaBalanco');
const cronogramaRoutes = require('./routes/cronograma');
const orcamentoRoutes = require('./routes/orcamento');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/importacao', importacaoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/lb', lbRoutes);
app.use('/api/cronograma', cronogramaRoutes);
app.use('/api/orcamento', orcamentoRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Serve o frontend em produção (DEVE vir depois das rotas /api).
// O catch-all '*' devolve index.html para as rotas do React Router.
if ((process.env.NODE_ENV || '').trim() === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Erro interno do servidor' });
});

// Inicializa o schema e só então sobe o servidor
initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Corá Arthaus API rodando na porta ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Falha ao inicializar o banco de dados:', err.message);
    process.exit(1);
  });
