import { useState, useRef } from 'react';
import api from '../api/client';
import { Upload, CheckCircle, XCircle, FileSpreadsheet, Clock } from 'lucide-react';

function UploadCard({ titulo, descricao, endpoint, onSuccess }) {
  const [status, setStatus] = useState('idle'); // idle | uploading | ok | erro
  const [msg, setMsg] = useState('');
  const [resultado, setResultado] = useState(null);
  const inputRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    setStatus('uploading');
    setMsg('');
    setResultado(null);

    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('tipo', 'linha_base');

    try {
      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      });
      setStatus('ok');
      setResultado(data);
      onSuccess?.();
    } catch (err) {
      setStatus('erro');
      setMsg(err.response?.data?.error || 'Erro ao processar o arquivo');
    }

    inputRef.current.value = '';
  }

  return (
    <div className="card">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-cora-50 flex items-center justify-center shrink-0">
          <FileSpreadsheet size={20} className="text-cora-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-800">{titulo}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{descricao}</p>
        </div>
      </div>

      <div className="mt-4">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          onChange={handleFile}
          disabled={status === 'uploading'}
        />
        <button
          onClick={() => inputRef.current.click()}
          disabled={status === 'uploading'}
          className="btn-primary flex items-center gap-2"
        >
          <Upload size={16} />
          {status === 'uploading' ? 'Processando...' : 'Selecionar arquivo .xlsm'}
        </button>
      </div>

      {status === 'uploading' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <div className="w-4 h-4 border-2 border-cora-500 border-t-transparent rounded-full animate-spin" />
          Lendo planilha e importando dados...
        </div>
      )}

      {status === 'ok' && resultado && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm mb-1">
            <CheckCircle size={16} /> Importação concluída
          </div>
          <ul className="text-xs text-emerald-600 space-y-0.5 ml-5 list-disc">
            {resultado.tarefas != null && <li>{resultado.tarefas} tarefas importadas</li>}
            {resultado.lb_registros != null && <li>{resultado.lb_registros} registros na Linha de Balanço</li>}
            {resultado.obra != null && <li>{resultado.obra} itens Obra + {resultado.areas_comuns} itens Áreas Comuns</li>}
          </ul>
        </div>
      )}

      {status === 'erro' && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <span className="text-sm text-red-700">{msg}</span>
        </div>
      )}
    </div>
  );
}

function LogsImportacao() {
  const [logs, setLogs] = useState([]);
  const [carregado, setCarregado] = useState(false);

  async function carregar() {
    const { data } = await api.get('/importacao/logs');
    setLogs(data);
    setCarregado(true);
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <Clock size={16} /> Histórico de importações
        </h3>
        <button onClick={carregar} className="btn-secondary text-xs">
          {carregado ? 'Atualizar' : 'Carregar histórico'}
        </button>
      </div>
      {carregado && logs.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">Nenhuma importação registrada</p>
      )}
      {logs.length > 0 && (
        <div className="divide-y divide-slate-100">
          {logs.map(log => {
            const resumo = log.resumo ? JSON.parse(log.resumo) : {};
            return (
              <div key={log.id} className="py-3 flex items-start justify-between text-sm">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${
                    log.tipo === 'cronograma' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {log.tipo}
                  </span>
                  <span className="text-slate-700 font-medium">{log.nome_arquivo}</span>
                  <div className="text-xs text-slate-400 mt-0.5">
                    por {log.usuario_nome} — {new Date(log.criado_em).toLocaleString('pt-BR')}
                  </div>
                </div>
                <div className="text-xs text-slate-500 text-right">
                  {resumo.tarefas && <div>{resumo.tarefas} tarefas</div>}
                  {resumo.lb_registros && <div>{resumo.lb_registros} LB</div>}
                  {resumo.obra && <div>Obra: {resumo.obra} | AC: {resumo.areas_comuns}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ImportacaoPage() {
  const [refresh, setRefresh] = useState(0);

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Importação de Dados</h1>
        <p className="text-slate-500 text-sm mt-1">
          Faça upload dos arquivos .xlsm para atualizar o banco de dados do app.
          Lançamentos de campo já registrados não são apagados.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Atenção:</strong> Os arquivos .xlsm são lidos em modo somente-leitura (valores cacheados).
        Certifique-se de que a planilha foi salva após o último cálculo automático.
      </div>

      <div className="space-y-4">
        <UploadCard
          titulo="Cronograma Corá.xlsm"
          descricao="Importa as abas CRONOGRAMA e LINHA DE BALANÇO — tarefas, datas, % prevista/realizada e grade da LB."
          endpoint="/importacao/cronograma"
          onSuccess={() => setRefresh(r => r + 1)}
        />
        <UploadCard
          titulo="Orçamento Corá.xlsm"
          descricao="Importa as abas ORÇAMENTO DE OBRA e ORÇAMENTO DE ÁREAS COMUNS — estrutura EAP e valores."
          endpoint="/importacao/orcamento"
          onSuccess={() => setRefresh(r => r + 1)}
        />
      </div>

      <LogsImportacao key={refresh} />
    </div>
  );
}
