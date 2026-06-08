/**
 * Limpa todos os dados (mantém estrutura e usuários). Uso: node reset-db.js
 */
require('dotenv').config();
const { pool } = require('./src/db');

async function main() {
  await pool.query(`
    TRUNCATE TABLE
      lb_replanejamentos, lb_campo, lb_planejado, tarefas, cronograma_versoes,
      orcamento_itens, orcamento_versoes, import_logs, riscos
    RESTART IDENTITY CASCADE
  `);
  console.log('Banco limpo (estrutura e usuários preservados).');
  await pool.end();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
