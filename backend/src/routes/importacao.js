const express = require('express');
const multer = require('multer');
const path = require('path');
const { getAll, tx, bulkInsert } = require('../db');
const { parseCronograma } = require('../parsers/cronogramaParser');
const { parseOrcamento } = require('../parsers/orcamentoParser');
const { authMiddleware, requirePerfil } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xlsm', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Use .xlsx ou .xlsm'));
    }
  }
});

// POST /api/importacao/cronograma
router.post(
  '/cronograma',
  authMiddleware,
  requirePerfil('gestor', 'admin'),
  upload.single('arquivo'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' });

    const { tipo = 'linha_base', nome } = req.body;

    let parsed;
    try {
      parsed = parseCronograma(req.file.buffer);
    } catch (e) {
      return res.status(422).json({ error: 'Erro ao processar arquivo: ' + e.message });
    }

    const { tarefas, linhaBalanco } = parsed;

    const nomeCronograma = nome || (tipo === 'linha_base'
      ? 'Linha de Base'
      : `Replanejamento ${new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`);

    try {
      const versaoId = await tx(async (client) => {
        const versaoRes = await client.query(
          `INSERT INTO cronograma_versoes (nome, tipo, usuario_id) VALUES ($1, $2, $3) RETURNING id`,
          [nomeCronograma, tipo, req.user.id]
        );
        const vid = versaoRes.rows[0].id;

        if (tipo === 'linha_base') {
          await client.query(
            `UPDATE cronograma_versoes SET ativa = 0 WHERE tipo = 'linha_base' AND id <> $1`,
            [vid]
          );
        }

        await bulkInsert(client, 'tarefas',
          ['versao_id', 'edt', 'nome', 'critica', 'origem', 'pacote', 'pavimento',
           'linha_balanco', 'inicio_lb', 'termino_lb', 'inicio', 'termino',
           'pct_prevista', 'pct_concluida', 'desvio_dias', 'nivel'],
          tarefas.map(t => [vid, t.edt, t.nome, t.critica, t.origem, t.pacote, t.pavimento,
            t.linha_balanco, t.inicio_lb, t.termino_lb, t.inicio, t.termino,
            t.pct_prevista, t.pct_concluida, t.desvio_dias, t.nivel])
        );

        await bulkInsert(client, 'lb_planejado',
          ['versao_id', 'data', 'pavimento', 'atividade'],
          linhaBalanco.map(lb => [vid, lb.data, lb.pavimento, lb.atividade])
        );

        await client.query(
          `INSERT INTO import_logs (tipo, nome_arquivo, status, resumo, usuario_id)
           VALUES ('cronograma', $1, 'ok', $2, $3)`,
          [req.file.originalname,
           JSON.stringify({ tarefas: tarefas.length, lb_registros: linhaBalanco.length }),
           req.user.id]
        );

        return vid;
      });

      res.json({
        ok: true,
        versao_id: versaoId,
        tarefas: tarefas.length,
        lb_registros: linhaBalanco.length
      });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao salvar no banco: ' + e.message });
    }
  }
);

// POST /api/importacao/orcamento
router.post(
  '/orcamento',
  authMiddleware,
  requirePerfil('gestor', 'admin'),
  upload.single('arquivo'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' });

    let parsed;
    try {
      parsed = parseOrcamento(req.file.buffer);
    } catch (e) {
      return res.status(422).json({ error: 'Erro ao processar arquivo: ' + e.message });
    }

    const { obra, areas_comuns } = parsed;

    try {
      await tx(async (client) => {
        for (const [tipo, itens] of [['obra', obra], ['areas_comuns', areas_comuns]]) {
          const versaoRes = await client.query(
            `INSERT INTO orcamento_versoes (tipo, usuario_id) VALUES ($1, $2) RETURNING id`,
            [tipo, req.user.id]
          );
          const vid = versaoRes.rows[0].id;

          await bulkInsert(client, 'orcamento_itens',
            ['versao_id', 'tipo_orcamento', 'codigo', 'alternativo', 'descricao', 'unidade',
             'qtde_servico', 'custo_servico', 'total', 'pct_total', 'nivel', 'eh_folha'],
            itens.map(item => [vid, tipo, item.codigo, item.alternativo, item.descricao, item.unidade,
              item.qtde_servico, item.custo_servico, item.total, item.pct_total,
              item.nivel, item.eh_folha])
          );
        }

        await client.query(
          `INSERT INTO import_logs (tipo, nome_arquivo, status, resumo, usuario_id)
           VALUES ('orcamento', $1, 'ok', $2, $3)`,
          [req.file.originalname,
           JSON.stringify({ obra: obra.length, areas_comuns: areas_comuns.length }),
           req.user.id]
        );
      });

      res.json({ ok: true, obra: obra.length, areas_comuns: areas_comuns.length });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao salvar no banco: ' + e.message });
    }
  }
);

// GET /api/importacao/logs
router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const logs = await getAll(`
      SELECT l.*, u.nome as usuario_nome
      FROM import_logs l
      LEFT JOIN users u ON l.usuario_id = u.id
      ORDER BY l.criado_em DESC
      LIMIT 50
    `);
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
