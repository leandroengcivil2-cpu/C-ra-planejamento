import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { UserPlus, Check, X, Shield, AlertCircle } from 'lucide-react';

const PERFIS = [
  { valor: 'gestor', label: 'Gestor', desc: 'Acesso total: importação, replanejamento, relatórios' },
  { valor: 'engenheiro', label: 'Engenheiro de Campo', desc: 'Lançamentos diários e visualização' },
  { valor: 'diretoria', label: 'Diretoria', desc: 'Somente leitura: Dashboard e Curva S' },
  { valor: 'admin', label: 'Administrador', desc: 'Gestão de usuários e configurações' }
];

const PERFIL_LABEL = Object.fromEntries(PERFIS.map(p => [p.valor, p.label]));

const PERFIL_COR = {
  gestor: 'bg-blue-100 text-blue-700',
  engenheiro: 'bg-emerald-100 text-emerald-700',
  diretoria: 'bg-amber-100 text-amber-700',
  admin: 'bg-purple-100 text-purple-700'
};

export default function UsuariosPage() {
  const { user: atual } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ nome: '', email: '', perfil: 'engenheiro' });
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get('/usuarios');
      setUsuarios(data);
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function handleCadastrar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await api.post('/usuarios', form);
      setForm({ nome: '', email: '', perfil: 'engenheiro' });
      await carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao cadastrar');
    } finally {
      setSalvando(false);
    }
  }

  async function alterarPerfil(u, perfil) {
    try {
      await api.put(`/usuarios/${u.id}`, { perfil });
      await carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao alterar perfil');
    }
  }

  async function alternarAtivo(u) {
    try {
      await api.put(`/usuarios/${u.id}`, { ativo: u.ativo ? 0 : 1 });
      await carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao alterar status');
    }
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Usuários</h1>
        <p className="text-slate-500 text-sm mt-1">
          Cadastre os e-mails da equipe. Quem estiver na lista entra no app só com o e-mail (sem senha).
        </p>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      {/* Cadastro */}
      <div className="card">
        <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <UserPlus size={18} className="text-cora-600" /> Cadastrar novo usuário
        </h2>
        <form onSubmit={handleCadastrar} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="label">Nome</label>
            <input className="input" placeholder="Nome completo" value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
          </div>
          <div className="md:col-span-1">
            <label className="label">E-mail</label>
            <input type="email" className="input" placeholder="email@empresa.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="md:col-span-1">
            <label className="label">Perfil</label>
            <select className="input" value={form.perfil}
              onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))}>
              {PERFIS.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <button type="submit" disabled={salvando} className="btn-primary w-full">
              {salvando ? 'Salvando...' : 'Cadastrar'}
            </button>
          </div>
        </form>
        <p className="text-xs text-slate-400 mt-3">
          {PERFIS.find(p => p.valor === form.perfil)?.desc}
        </p>
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Carregando...</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mail</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Perfil</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Status</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className={`border-b border-slate-50 ${u.ativo ? '' : 'opacity-50'}`}>
                  <td className="py-2.5 px-4 text-sm font-medium text-slate-700">
                    {u.nome}
                    {u.id === atual.id && <span className="ml-2 text-xs text-cora-500">(você)</span>}
                  </td>
                  <td className="py-2.5 px-4 text-sm text-slate-500">{u.email}</td>
                  <td className="py-2.5 px-4">
                    <select
                      value={u.perfil}
                      onChange={e => alterarPerfil(u, e.target.value)}
                      className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer ${PERFIL_COR[u.perfil] || 'bg-slate-100 text-slate-600'}`}
                    >
                      {PERFIS.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
                    </select>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {u.ativo
                      ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Check size={14} /> Ativo</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-slate-400"><X size={14} /> Inativo</span>}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {u.id !== atual.id && (
                      <button
                        onClick={() => alternarAtivo(u)}
                        className="text-xs font-medium text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1 hover:bg-slate-50"
                      >
                        {u.ativo ? 'Desativar' : 'Reativar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 flex items-start gap-2">
        <Shield size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <span>
          O acesso é por e-mail, sem senha. Só os e-mails desta lista (ativos) conseguem entrar.
          Para bloquear alguém, use <strong>Desativar</strong> — o histórico de lançamentos da pessoa é preservado.
        </span>
      </div>
    </div>
  );
}
