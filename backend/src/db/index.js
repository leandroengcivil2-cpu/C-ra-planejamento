const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('ERRO: variável DATABASE_URL não definida. Configure a conexão do PostgreSQL (Neon) no .env');
}

// Neon e a maioria dos provedores exigem SSL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
  max: 5
});

/**
 * Executa uma query e retorna o resultado completo do pg ({ rows, rowCount }).
 * Aceita placeholders $1, $2, ...
 */
async function query(text, params = []) {
  return pool.query(text, params);
}

/** Retorna a primeira linha (ou undefined). */
async function getOne(text, params = []) {
  const r = await pool.query(text, params);
  return r.rows[0];
}

/** Retorna todas as linhas. */
async function getAll(text, params = []) {
  const r = await pool.query(text, params);
  return r.rows;
}

/**
 * Executa uma função dentro de uma transação.
 * A função recebe um client com .query(text, params).
 */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Inserção em lote (multi-row) — muito mais rápida que inserir linha a linha,
 * essencial quando o banco está remoto (Neon).
 *
 * @param client  cliente da transação (deve ter .query)
 * @param table   nome da tabela
 * @param columns array de nomes de colunas
 * @param rows    array de arrays de valores (mesma ordem de columns)
 */
async function bulkInsert(client, table, columns, rows) {
  if (!rows.length) return;

  // Postgres limita a ~65535 parâmetros por statement.
  const maxParams = 60000;
  const rowsPerChunk = Math.max(1, Math.floor(maxParams / columns.length));

  for (let start = 0; start < rows.length; start += rowsPerChunk) {
    const chunk = rows.slice(start, start + rowsPerChunk);
    const params = [];
    const valuesSql = chunk.map((row, r) => {
      const placeholders = columns.map((_, c) => `$${r * columns.length + c + 1}`);
      params.push(...row);
      return `(${placeholders.join(',')})`;
    }).join(',');

    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${valuesSql}`;
    await client.query(sql, params);
  }
}

/** Cria as tabelas (idempotente) a partir do schema.sql. */
async function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  console.log('Schema PostgreSQL verificado/criado.');
}

module.exports = { pool, query, getOne, getAll, tx, bulkInsert, initSchema };
