const express = require('express');
const { getOne, getAll, query } = require('../db');
const { authMiddleware, requirePerfil } = require('../middleware/auth');

const router = express.Router();

// Ordem dos pavimentos. As fases de edifício (Fundação, Fachada, Elevador...)
// ficam no rodapé (índices 0-4); os 31 pavimentos vêm em seguida (Térreo->Cobertura).
const ORDEM_PAVIMENTOS = [
  'Fundação', 'Fachada 1ª Metade', 'Fachada 2ª Metade', 'Esquadria de Alumínio', 'Elevador',
  'Térreo', 'Mezanino', 'Sob 1', 'Sob 2', 'Sob 3', 'Lazer',
  ...Array.from({ length: 22 }, (_, i) => `${i + 1}º Pav`),
  'Duplex Inferior', 'Duplex Superior', 'Cobertura'
];

async function versaoAtiva() {
  return getOne(
    `SELECT id FROM cronograma_versoes WHERE tipo = 'linha_base' AND ativa = 1 ORDER BY id DESC LIMIT 1`
  );
}

/**
 * GET /api/lb/planejado
 * Grade planejada da LB. Filtros: data_inicio, data_fim, atividade
 */
router.get('/planejado', authMiddleware, async (req, res) => {
  try {
    const { data_inicio, data_fim, atividade } = req.query;
    const versao = await versaoAtiva();
    if (!versao) return res.json({ dados: [], pavimentos: [], datas: [], atividades: [] });

    let q = `SELECT data, pavimento, atividade FROM lb_planejado WHERE versao_id = $1`;
    const params = [versao.id];
    let i = 2;

    if (data_inicio) { q += ` AND data >= $${i++}`; params.push(data_inicio); }
    if (data_fim) { q += ` AND data <= $${i++}`; params.push(data_fim); }
    if (atividade) { q += ` AND atividade = $${i++}`; params.push(atividade); }

    q += ' ORDER BY data ASC, pavimento ASC';

    const registros = await getAll(q, params);

    const datasSet = [...new Set(registros.map(r => r.data))].sort();
    const pavimentosSet = [...new Set(registros.map(r => r.pavimento))]
      .sort((a, b) => ordenarPavimento(a) - ordenarPavimento(b));
    const atividadesSet = [...new Set(registros.map(r => r.atividade).filter(Boolean))].sort();

    res.json({ dados: registros, pavimentos: pavimentosSet, datas: datasSet, atividades: atividadesSet });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/lb/atividades
 * Atividades com período planejado e realizado por pavimento (gráfico diagonal).
 */
router.get('/atividades', authMiddleware, async (req, res) => {
  try {
    const versao = await versaoAtiva();
    if (!versao) return res.json([]);

    const planejado = await getAll(`
      SELECT atividade, pavimento,
             MIN(data) as inicio, MAX(data) as termino, COUNT(*) as dias
      FROM lb_planejado
      WHERE versao_id = $1 AND atividade IS NOT NULL
      GROUP BY atividade, pavimento
      ORDER BY atividade, MIN(data)
    `, [versao.id]);

    const realizado = await getAll(`
      SELECT atividade, pavimento,
             MIN(data) as inicio, MAX(data) as termino,
             COUNT(*) as dias, AVG(pct_avanco) as pct_media
      FROM lb_campo
      GROUP BY atividade, pavimento
    `);

    const realizadoMap = {};
    for (const r of realizado) realizadoMap[`${r.atividade}|${r.pavimento}`] = r;

    const atividadesMap = {};
    for (const p of planejado) {
      if (!atividadesMap[p.atividade]) {
        atividadesMap[p.atividade] = { nome: p.atividade, pavimentos: [] };
      }
      const real = realizadoMap[`${p.atividade}|${p.pavimento}`] || null;
      atividadesMap[p.atividade].pavimentos.push({
        pavimento: p.pavimento,
        ordem: ordenarPavimento(p.pavimento),
        planejado: { inicio: p.inicio, termino: p.termino, dias: Number(p.dias) },
        realizado: real ? { inicio: real.inicio, termino: real.termino, dias: Number(real.dias), pct: real.pct_media } : null
      });
    }

    const atividades = Object.values(atividadesMap).map(a => ({
      ...a,
      pavimentos: a.pavimentos.sort((x, y) => x.ordem - y.ordem)
    }));

    res.json(atividades);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Computa os segmentos da LB (uma barra por atividade×pavimento):
 * base (linha de base) + vigente (plano atual, com replanejamentos) + realizado.
 */
async function computarSegmentos(versaoId) {
  const base = await getAll(`
    SELECT atividade, pavimento,
           MIN(data) as inicio, MAX(data) as fim, COUNT(*) as dias
    FROM lb_planejado
    WHERE versao_id = $1 AND atividade IS NOT NULL
    GROUP BY atividade, pavimento
  `, [versaoId]);

  const vigenteRows = await getAll(
    `SELECT atividade, pavimento, inicio, fim FROM lb_vigente WHERE versao_id = $1`, [versaoId]
  );
  const vigMap = {};
  for (const v of vigenteRows) vigMap[`${v.atividade}|${v.pavimento}`] = v;

  const realizado = await getAll(`
    SELECT atividade, pavimento, MIN(data) as inicio, MAX(data) as fim,
           COUNT(*) as dias, MAX(pct_avanco) as pct
    FROM lb_campo GROUP BY atividade, pavimento
  `);
  const realMap = {};
  for (const r of realizado) realMap[`${r.atividade}|${r.pavimento}`] = r;

  return base.map(b => {
    const chave = `${b.atividade}|${b.pavimento}`;
    const vig = vigMap[chave];
    const real = realMap[chave];
    return {
      atividade: b.atividade,
      pavimento: b.pavimento,
      ordem: ordenarPavimento(b.pavimento),
      base_inicio: b.inicio,
      base_fim: b.fim,
      inicio: vig ? vig.inicio : b.inicio,
      fim: vig ? vig.fim : b.fim,
      dias: Number(b.dias),
      replanejado: !!vig,
      realizado: real ? { inicio: real.inicio, fim: real.fim, dias: Number(real.dias), pct: real.pct } : null
    };
  });
}

function segmentosResposta(segmentos) {
  const atividades = [...new Set(segmentos.map(s => s.atividade))];
  const pavimentos = [...new Set(segmentos.map(s => s.pavimento))]
    .sort((a, b) => ordenarPavimento(a) - ordenarPavimento(b));
  const todasDatas = segmentos.flatMap(s => [s.base_inicio, s.fim, s.base_fim, s.inicio]).filter(Boolean).sort();
  return {
    segmentos,
    atividades,
    pavimentos,
    periodo: { inicio: todasDatas[0], fim: todasDatas[todasDatas.length - 1] }
  };
}

/**
 * GET /api/lb/segmentos — barras de atividade (base + vigente) para a grade interativa.
 */
router.get('/segmentos', authMiddleware, async (req, res) => {
  try {
    const versao = await versaoAtiva();
    if (!versao) return res.json({ segmentos: [], atividades: [], pavimentos: [], periodo: {} });
    const segmentos = await computarSegmentos(versao.id);
    res.json(segmentosResposta(segmentos));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/lb/replanejar — move uma atividade num pavimento para nova data de início.
 * body: { atividade, pavimento, nova_inicio (ISO), motivo, cascata (bool) }
 * Se cascata=true, desloca a mesma atividade nos pavimentos seguintes pelo mesmo delta,
 * preservando o ciclo. A linha de base nunca é alterada.
 */
router.post('/replanejar', authMiddleware, requirePerfil('gestor', 'admin'), async (req, res) => {
  const { atividade, pavimento, nova_inicio, motivo, cascata } = req.body;
  if (!atividade || !pavimento || !nova_inicio) {
    return res.status(400).json({ error: 'atividade, pavimento e nova_inicio são obrigatórios' });
  }

  try {
    const versao = await versaoAtiva();
    if (!versao) return res.status(400).json({ error: 'Nenhum cronograma ativo' });

    const segmentos = await computarSegmentos(versao.id);
    const alvo = segmentos.find(s => s.atividade === atividade && s.pavimento === pavimento);
    if (!alvo) return res.status(404).json({ error: 'Atividade/pavimento não encontrado na LB' });

    const delta = diffDias(alvo.inicio, nova_inicio); // dias a deslocar
    if (delta === 0) return res.json(segmentosResposta(segmentos));

    const tipo = delta > 0 ? 'atraso' : 'antecipacao';
    if (tipo === 'atraso' && !motivo) {
      return res.status(400).json({ error: 'Justificativa é obrigatória para atrasos' });
    }

    // Alvo: nova posição preservando a duração
    const duracao = diffDias(alvo.inicio, alvo.fim);
    await upsertVigente(versao.id, atividade, pavimento, nova_inicio, addDias(nova_inicio, duracao));

    // Cascata: pavimentos da mesma atividade que começam DEPOIS (base) → mesmo delta
    if (cascata) {
      const seguintes = segmentos.filter(s =>
        s.atividade === atividade && s.pavimento !== pavimento && s.base_inicio > alvo.base_inicio
      );
      for (const s of seguintes) {
        await upsertVigente(versao.id, s.atividade, s.pavimento,
          addDias(s.inicio, delta), addDias(s.fim, delta));
      }
    }

    await query(`
      INSERT INTO lb_replanejamentos (atividade, pavimento_inicio, data_original, nova_data, tipo, motivo, usuario_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [atividade, pavimento, alvo.inicio, nova_inicio, tipo, motivo || 'Antecipação', req.user.id]);

    const atualizados = await computarSegmentos(versao.id);
    res.json({ ...segmentosResposta(atualizados), delta, tipo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/lb/replanejar/reset — volta à linha de base (tudo ou uma atividade).
 * body: { atividade? }
 */
router.post('/replanejar/reset', authMiddleware, requirePerfil('gestor', 'admin'), async (req, res) => {
  try {
    const versao = await versaoAtiva();
    if (!versao) return res.status(400).json({ error: 'Nenhum cronograma ativo' });
    if (req.body.atividade) {
      await query('DELETE FROM lb_vigente WHERE versao_id = $1 AND atividade = $2', [versao.id, req.body.atividade]);
    } else {
      await query('DELETE FROM lb_vigente WHERE versao_id = $1', [versao.id]);
    }
    const segmentos = await computarSegmentos(versao.id);
    res.json(segmentosResposta(segmentos));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function upsertVigente(versaoId, atividade, pavimento, inicio, fim) {
  await query(`
    INSERT INTO lb_vigente (versao_id, atividade, pavimento, inicio, fim)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (versao_id, atividade, pavimento)
    DO UPDATE SET inicio = EXCLUDED.inicio, fim = EXCLUDED.fim, atualizado_em = NOW()
  `, [versaoId, atividade, pavimento, inicio, fim]);
}

/**
 * POST /api/lb/campo — lançamento diário
 */
router.post('/campo', authMiddleware, requirePerfil('gestor', 'engenheiro', 'admin'), async (req, res) => {
  const { data, pavimento, atividade, status, pct_avanco, observacao } = req.body;

  if (!data || !pavimento || !atividade || !status) {
    return res.status(400).json({ error: 'data, pavimento, atividade e status são obrigatórios' });
  }

  try {
    await query(`
      INSERT INTO lb_campo (data, pavimento, atividade, status, pct_avanco, observacao, usuario_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (data, pavimento, atividade) DO UPDATE SET
        status = EXCLUDED.status,
        pct_avanco = EXCLUDED.pct_avanco,
        observacao = EXCLUDED.observacao,
        usuario_id = EXCLUDED.usuario_id
    `, [data, pavimento, atividade, status, pct_avanco || 0, observacao || null, req.user.id]);

    const alerta = await verificarCiclo(atividade, pavimento, data);
    res.json({ ok: true, alerta });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/lb/campo — histórico. Filtros: data_inicio, data_fim, atividade, pavimento
 */
router.get('/campo', authMiddleware, async (req, res) => {
  try {
    const { data_inicio, data_fim, atividade, pavimento } = req.query;

    let q = `
      SELECT c.*, u.nome as usuario_nome
      FROM lb_campo c
      LEFT JOIN users u ON c.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;

    if (data_inicio) { q += ` AND c.data >= $${i++}`; params.push(data_inicio); }
    if (data_fim) { q += ` AND c.data <= $${i++}`; params.push(data_fim); }
    if (atividade) { q += ` AND c.atividade = $${i++}`; params.push(atividade); }
    if (pavimento) { q += ` AND c.pavimento = $${i++}`; params.push(pavimento); }

    q += ' ORDER BY c.data DESC, c.pavimento ASC';

    res.json(await getAll(q, params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/lb/histograma/:atividade — ciclo planejado vs realizado por pavimento
 */
router.get('/histograma/:atividade', authMiddleware, async (req, res) => {
  try {
    const { atividade } = req.params;
    const versao = await versaoAtiva();
    if (!versao) return res.json([]);

    const planejado = await getAll(`
      SELECT pavimento, COUNT(*) as dias_planejados, MIN(data) as inicio, MAX(data) as termino
      FROM lb_planejado
      WHERE versao_id = $1 AND atividade = $2
      GROUP BY pavimento
    `, [versao.id, atividade]);

    const realizado = await getAll(`
      SELECT pavimento, COUNT(*) as dias_reais, MIN(data) as inicio, MAX(data) as termino,
             MAX(pct_avanco) as pct_final
      FROM lb_campo
      WHERE atividade = $1
      GROUP BY pavimento
    `, [atividade]);

    const realizadoMap = {};
    for (const r of realizado) realizadoMap[r.pavimento] = r;

    const histograma = planejado.map(p => {
      const real = realizadoMap[p.pavimento];
      const diasPlan = Number(p.dias_planejados);
      const diasReais = real ? Number(real.dias_reais) : null;
      return {
        pavimento: p.pavimento,
        ordem: ordenarPavimento(p.pavimento),
        dias_planejados: diasPlan,
        inicio_plan: p.inicio,
        termino_plan: p.termino,
        dias_reais: diasReais,
        inicio_real: real?.inicio || null,
        termino_real: real?.termino || null,
        pct_final: real?.pct_final ?? null,
        variacao_dias: diasReais != null ? diasReais - diasPlan : null
      };
    }).sort((a, b) => a.ordem - b.ordem);

    res.json(histograma);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/lb/replanejamento
 */
router.post('/replanejamento', authMiddleware, requirePerfil('gestor', 'admin'), async (req, res) => {
  const { atividade, pavimento_inicio, data_original, nova_data, tipo, motivo } = req.body;

  if (!atividade || !data_original || !nova_data || !tipo || !motivo) {
    return res.status(400).json({ error: 'Campos obrigatórios: atividade, data_original, nova_data, tipo, motivo' });
  }
  if (!['antecipacao', 'atraso'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo deve ser antecipacao ou atraso' });
  }

  try {
    await query(`
      INSERT INTO lb_replanejamentos (atividade, pavimento_inicio, data_original, nova_data, tipo, motivo, usuario_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [atividade, pavimento_inicio || '', data_original, nova_data, tipo, motivo, req.user.id]);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/lb/replanejamentos
 */
router.get('/replanejamentos', authMiddleware, async (req, res) => {
  try {
    const { atividade } = req.query;
    let q = `
      SELECT r.*, u.nome as usuario_nome
      FROM lb_replanejamentos r
      LEFT JOIN users u ON r.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (atividade) { q += ' AND r.atividade = $1'; params.push(atividade); }
    q += ' ORDER BY r.criado_em DESC';

    res.json(await getAll(q, params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── helpers ────────────────────────────────────────────────────

function ordenarPavimento(nome) {
  const idx = ORDEM_PAVIMENTOS.indexOf(String(nome).trim());
  return idx === -1 ? 99 : idx;
}

// Diferença em dias corridos entre duas datas ISO (b - a)
function diffDias(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

// Soma n dias corridos a uma data ISO, retornando ISO
function addDias(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function verificarCiclo(atividade, pavimento, dataAtual) {
  const versao = await versaoAtiva();
  if (!versao) return null;

  const plano = await getOne(`
    SELECT MAX(data) as termino
    FROM lb_planejado
    WHERE versao_id = $1 AND atividade = $2 AND pavimento = $3
  `, [versao.id, atividade, pavimento]);

  if (!plano?.termino) return null;

  const diasAtraso = Math.floor(
    (new Date(dataAtual) - new Date(plano.termino)) / (1000 * 60 * 60 * 24)
  );

  if (diasAtraso > 1) {
    return {
      tipo: 'atraso_ciclo',
      mensagem: `Atividade "${atividade}" no ${pavimento} ultrapassou o ciclo planejado em ${diasAtraso} dias`,
      dias_atraso: diasAtraso,
      termino_planejado: plano.termino
    };
  }
  return null;
}

module.exports = router;
