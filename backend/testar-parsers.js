/**
 * Script de teste: roda os parsers nas planilhas reais e mostra um resumo.
 * Uso: node testar-parsers.js
 */
const fs = require('fs');
const path = require('path');
const { parseCronograma } = require('./src/parsers/cronogramaParser');
const { parseOrcamento } = require('./src/parsers/orcamentoParser');

// As planilhas ficam na pasta-pai do projeto (Corá-Planejamento App)
const PASTA = path.join(__dirname, '..', '..');

function testarCronograma() {
  console.log('\n=== CRONOGRAMA ===');
  const buf = fs.readFileSync(path.join(PASTA, 'Cronograma Corá.xlsm'));
  const { tarefas, linhaBalanco } = parseCronograma(buf);

  console.log(`Tarefas: ${tarefas.length}`);
  console.log(`Registros LB: ${linhaBalanco.length}`);

  console.log('\nPrimeiras 3 tarefas:');
  tarefas.slice(0, 3).forEach(t => {
    console.log(`  [${t.edt}] ${t.nome.trim().slice(0, 40)} | crit=${t.critica} | prev=${(t.pct_prevista*100).toFixed(1)}% | real=${(t.pct_concluida*100).toFixed(1)}% | LB:${t.inicio_lb}→${t.termino_lb}`);
  });

  // Tarefa raiz (nível 1)
  const raiz = tarefas.find(t => t.nivel === 1);
  if (raiz) {
    console.log(`\nRaiz: ${raiz.nome.trim()} | prevista=${(raiz.pct_prevista*100).toFixed(2)}% | realizada=${(raiz.pct_concluida*100).toFixed(2)}%`);
  }

  // Atividades únicas da LB
  const atividades = [...new Set(linhaBalanco.map(l => l.atividade))];
  console.log(`\nAtividades na LB (${atividades.length}): ${atividades.slice(0, 10).join(', ')}...`);

  const pavimentos = [...new Set(linhaBalanco.map(l => l.pavimento))];
  console.log(`Pavimentos na LB (${pavimentos.length}): ${pavimentos.join(', ')}`);

  const datas = linhaBalanco.map(l => l.data).sort();
  console.log(`Período LB: ${datas[0]} → ${datas[datas.length-1]}`);
}

function testarOrcamento() {
  console.log('\n=== ORÇAMENTO ===');
  const buf = fs.readFileSync(path.join(PASTA, 'Orçamento Corá.xlsm'));
  const { obra, areas_comuns } = parseOrcamento(buf);

  console.log(`Itens Obra: ${obra.length}`);
  console.log(`Itens Áreas Comuns: ${areas_comuns.length}`);

  const raizObra = obra.find(i => i.nivel === 1);
  const raizAc = areas_comuns.find(i => i.nivel === 1);
  console.log(`\nRaiz Obra: ${raizObra?.descricao} = R$ ${raizObra?.total?.toLocaleString('pt-BR')}`);
  console.log(`Raiz Áreas Comuns: ${raizAc?.descricao} = R$ ${raizAc?.total?.toLocaleString('pt-BR')}`);

  console.log('\nGrupos nível 2 (Obra):');
  obra.filter(i => i.nivel === 2).slice(0, 8).forEach(g => {
    console.log(`  [${g.codigo}] ${g.descricao.slice(0, 35)} = R$ ${g.total?.toLocaleString('pt-BR')}`);
  });
}

try {
  testarCronograma();
  testarOrcamento();
  console.log('\n✓ Parsers executados com sucesso!\n');
} catch (e) {
  console.error('\n✗ ERRO:', e.message);
  console.error(e.stack);
}
