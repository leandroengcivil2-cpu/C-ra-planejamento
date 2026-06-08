import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Building2 } from 'lucide-react';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    const res = await login(email);
    if (res.ok) {
      navigate('/', { replace: true });
    } else {
      setErro(res.error);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cora-800 to-cora-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-2xl mb-4">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Corá Arthaus</h1>
          <p className="text-cora-300 text-sm mt-1">Gestão de Obra</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="font-semibold text-slate-800 text-lg mb-1">Entrar</h2>
          <p className="text-sm text-slate-500 mb-5">Informe o e-mail cadastrado pela sua equipe.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                className="input"
                placeholder="seu@email.com.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {erro}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-6">
            Acesso restrito à equipe.<br />Não tem acesso? Peça ao gestor para cadastrar seu e-mail.
          </p>
        </div>
      </div>
    </div>
  );
}
