import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, List, CreditCard, Banknote, Settings, LogOut } from 'lucide-react';

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };

  const navItems = [
    { path: '/', label: 'Дашборд', icon: <Home size={20} /> },
    { path: '/transactions', label: 'Транзакции', icon: <List size={20} /> },
    { path: '/incomes', label: 'Регулярные Доходы', icon: <Banknote size={20} /> },
    { path: '/debts', label: 'Долги', icon: <CreditCard size={20} /> },
    { path: '/settings', label: 'Настройки', icon: <Settings size={20} /> },
  ];

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          Finance Manager
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="secondary" onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <LogOut size={18} /> Выйти
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
