import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, GitBranch, CalendarDays,
  DollarSign, Upload, LogOut, Building2, Users
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/linha-balanco',  icon: GitBranch,        label: 'Linha de Balanço' },
  { to: '/cronograma',     icon: CalendarDays,     label: 'Cronograma' },
  { to: '/orcamento',      icon: DollarSign,       label: 'Orçamento' },
  { to: '/importacao',     icon: Upload,           label: 'Importação', perfis: ['gestor','admin'] },
  { to: '/usuarios',       icon: Users,            label: 'Usuários',   perfis: ['gestor','admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const itemsVisiveis = navItems.filter(
    item => !item.perfis || item.perfis.includes(user?.perfil)
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-cora-800 text-white flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-cora-700">
          <div className="flex items-center gap-2">
            <Building2 size={22} className="text-cora-100" />
            <div>
              <div className="font-bold text-white leading-tight">Corá Arthaus</div>
              <div className="text-xs text-cora-300">Gestão de Obra</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {itemsVisiveis.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cora-600 text-white'
                    : 'text-cora-200 hover:bg-cora-700 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-cora-700">
          <div className="px-3 py-2 mb-1">
            <div className="text-sm font-medium text-white truncate">{user?.nome}</div>
            <div className="text-xs text-cora-300 capitalize">{user?.perfil}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-cora-300 hover:text-white hover:bg-cora-700 rounded-lg text-sm transition-colors"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
