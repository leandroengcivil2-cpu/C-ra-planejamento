/**
 * Teste end-to-end: login → importa cronograma → importa orçamento → dashboard.
 * Usa a API HTTP real. Node 20+ (fetch/FormData/Blob nativos).
 */
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:3001/api';
// As planilhas ficam na pasta-pai do projeto (Corá-Planejamento App)
const PASTA = path.join(__dirname, '..', '..');

async function main() {
  // 1. Login
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'leandro@coraarthaus.com.br', senha: 'admin123' })
  });
  const { token } = await loginRes.json();
  console.log('1. Login OK');

  // 2. Importa cronograma
  const cronoBuf = fs.readFileSync(path.join(PASTA, 'Cronograma Corá.xlsm'));
  const fd1 = new FormData();
  fd1.append('arquivo', new Blob([cronoBuf]), 'Cronograma Corá.xlsm');
  fd1.append('tipo', 'linha_base');
  const r1 = await fetch(`${API}/importacao/cronograma`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd1
  });
  console.log('2. Importação cronograma:', await r1.json());

  // 3. Importa orçamento
  const orcBuf = fs.readFileSync(path.join(PASTA, 'Orçamento Corá.xlsm'));
  const fd2 = new FormData();
  fd2.append('arquivo', new Blob([orcBuf]), 'Orçamento Corá.xlsm');
  const r2 = await fetch(`${API}/importacao/orcamento`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd2
  });
  console.log('3. Importação orçamento:', await r2.json());

  // 4. Dashboard
  const dash = await (await fetch(`${API}/dashboard?visao=total`, {
    headers: { Authorization: `Bearer ${token}` }
  })).json();
  console.log('\n4. DASHBOARD:');
  console.log('   % Prevista:', (dash.pct_prevista * 100).toFixed(2) + '%');
  console.log('   % Realizada:', (dash.pct_concluida * 100).toFixed(2) + '%');
  console.log('   IDP:', dash.idp?.toFixed(3), '| Semáforo:', dash.semaforo_idp);
  console.log('   VA:', dash.va?.toLocaleString('pt-BR'));
  console.log('   CP:', dash.cp?.toLocaleString('pt-BR'));
  console.log('   Pontos Curva S:', dash.curva_s?.length);

  // 5. LB atividades
  const lb = await (await fetch(`${API}/lb/atividades`, {
    headers: { Authorization: `Bearer ${token}` }
  })).json();
  console.log('\n5. LINHA DE BALANÇO:', lb.length, 'atividades');
  console.log('   Exemplo:', lb[0]?.nome, '-', lb[0]?.pavimentos?.length, 'pavimentos');

  // 6. Orçamento grupos
  const orc = await (await fetch(`${API}/orcamento/itens?tipo=total&nivel_max=1`, {
    headers: { Authorization: `Bearer ${token}` }
  })).json();
  console.log('\n6. ORÇAMENTO totais:');
  console.log('   Obra:', orc.totais.obra?.toLocaleString('pt-BR'));
  console.log('   Áreas Comuns:', orc.totais.areas_comuns?.toLocaleString('pt-BR'));
  console.log('   Total:', orc.totais.total?.toLocaleString('pt-BR'));

  console.log('\n✓ E2E completo!');
}

main().catch(e => { console.error('ERRO:', e); process.exit(1); });
