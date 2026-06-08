-- ============================================================
-- SCHEMA: Corá Arthaus — Gestão de Obra (PostgreSQL)
-- ============================================================

-- Usuários
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK(perfil IN ('gestor','engenheiro','diretoria','admin')),
  ativo INTEGER DEFAULT 1,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CRONOGRAMA
-- ============================================================

CREATE TABLE IF NOT EXISTS cronograma_versoes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('linha_base','replanejamento')),
  data_importacao TIMESTAMPTZ DEFAULT NOW(),
  usuario_id INTEGER REFERENCES users(id),
  ativa INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tarefas (
  id SERIAL PRIMARY KEY,
  versao_id INTEGER NOT NULL REFERENCES cronograma_versoes(id),
  edt TEXT NOT NULL,
  nome TEXT NOT NULL,
  critica INTEGER DEFAULT 0,
  origem TEXT,
  pacote TEXT,
  pavimento TEXT,
  linha_balanco TEXT,
  inicio_lb TEXT,
  termino_lb TEXT,
  inicio TEXT,
  termino TEXT,
  pct_prevista REAL DEFAULT 0,
  pct_concluida REAL DEFAULT 0,
  desvio_dias INTEGER DEFAULT 0,
  nivel INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_tarefas_versao ON tarefas(versao_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_edt ON tarefas(edt);

-- ============================================================
-- LINHA DE BALANÇO
-- ============================================================

CREATE TABLE IF NOT EXISTS lb_planejado (
  id SERIAL PRIMARY KEY,
  versao_id INTEGER NOT NULL REFERENCES cronograma_versoes(id),
  data TEXT NOT NULL,
  pavimento TEXT NOT NULL,
  atividade TEXT
);

CREATE INDEX IF NOT EXISTS idx_lb_plan_versao ON lb_planejado(versao_id);
CREATE INDEX IF NOT EXISTS idx_lb_plan_data ON lb_planejado(data);

CREATE TABLE IF NOT EXISTS lb_campo (
  id SERIAL PRIMARY KEY,
  data TEXT NOT NULL,
  pavimento TEXT NOT NULL,
  atividade TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('iniciado','em_andamento','concluido','paralisado')),
  pct_avanco REAL DEFAULT 0,
  observacao TEXT,
  usuario_id INTEGER REFERENCES users(id),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(data, pavimento, atividade)
);

CREATE INDEX IF NOT EXISTS idx_lb_campo_data ON lb_campo(data);

CREATE TABLE IF NOT EXISTS lb_replanejamentos (
  id SERIAL PRIMARY KEY,
  atividade TEXT NOT NULL,
  pavimento_inicio TEXT NOT NULL,
  data_original TEXT NOT NULL,
  nova_data TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('antecipacao','atraso')),
  motivo TEXT NOT NULL,
  usuario_id INTEGER REFERENCES users(id),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORÇAMENTO
-- ============================================================

CREATE TABLE IF NOT EXISTS orcamento_versoes (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK(tipo IN ('obra','areas_comuns')),
  data_importacao TIMESTAMPTZ DEFAULT NOW(),
  usuario_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS orcamento_itens (
  id SERIAL PRIMARY KEY,
  versao_id INTEGER NOT NULL REFERENCES orcamento_versoes(id),
  tipo_orcamento TEXT NOT NULL CHECK(tipo_orcamento IN ('obra','areas_comuns')),
  codigo TEXT NOT NULL,
  alternativo TEXT,
  descricao TEXT NOT NULL,
  unidade TEXT,
  qtde_servico REAL,
  custo_servico REAL,
  total REAL,
  pct_total REAL,
  nivel INTEGER DEFAULT 1,
  eh_folha INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_orc_versao ON orcamento_itens(versao_id);
CREATE INDEX IF NOT EXISTS idx_orc_codigo ON orcamento_itens(codigo);

-- ============================================================
-- GESTÃO DE RISCOS
-- ============================================================

CREATE TABLE IF NOT EXISTS riscos (
  id SERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  categoria TEXT,
  probabilidade TEXT CHECK(probabilidade IN ('baixa','media','alta')),
  impacto TEXT CHECK(impacto IN ('baixo','medio','alto')),
  criticidade TEXT,
  responsavel TEXT,
  plano_acao TEXT,
  status TEXT DEFAULT 'aberto' CHECK(status IN ('aberto','monitorando','mitigado','fechado')),
  usuario_id INTEGER REFERENCES users(id),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LOG DE IMPORTAÇÕES
-- ============================================================

CREATE TABLE IF NOT EXISTS import_logs (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL,
  nome_arquivo TEXT,
  status TEXT DEFAULT 'ok',
  resumo TEXT,
  usuario_id INTEGER REFERENCES users(id),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DADOS INICIAIS — usuários iniciais (login por e-mail, sem senha)
-- ============================================================

INSERT INTO users (nome, email, senha_hash, perfil)
VALUES ('Leandro Oliveira', 'leandro.oliveira@sejahype.com.br', 'sem_senha', 'gestor')
ON CONFLICT (email) DO NOTHING;

-- Usuários legados (mantidos para não quebrar acessos existentes)
INSERT INTO users (nome, email, senha_hash, perfil)
VALUES ('Administrador', 'admin@coraarthaus.com.br', 'sem_senha', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (nome, email, senha_hash, perfil)
VALUES ('Leandro Oliveira', 'leandro@coraarthaus.com.br', 'sem_senha', 'gestor')
ON CONFLICT (email) DO NOTHING;
