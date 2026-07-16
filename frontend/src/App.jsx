import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  ShoppingCart, 
  Plus, 
  Trash2, 
  LogOut, 
  Check, 
  X, 
  Lock, 
  RefreshCw, 
  Play, 
  Pause, 
  Wallet, 
  ListFilter 
} from 'lucide-react';
import { 
  initTelegram, 
  getTelegramUser, 
  getAuthHeaders, 
  saveTokenFromUrl, 
  logout, 
  tg 
} from './TelegramSDK';

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin;

function App() {
  // Navigation & Authentication
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  
  // Data States
  const [profile, setProfile] = useState({ balance: 0, totalIncome: 0, totalExpense: 0 });
  const [transactions, setTransactions] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  
  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Modal States
  const [showTxModal, setShowTxModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  
  // Form States
  const [txForm, setTxForm] = useState({ type: 'expense', amount: '', category: 'Еда', description: '', date: new Date().toISOString().slice(0, 10) });
  const [subForm, setSubForm] = useState({ name: '', amount: '', period: 'monthly', next_payment_date: new Date().toISOString().slice(0, 10) });
  const [shoppingForm, setShoppingForm] = useState({ item_name: '', estimated_price: '', priority: 'medium' });

  // Filter States
  const [txFilter, setTxFilter] = useState('all'); // all, income, expense
  const [txCategoryFilter, setTxCategoryFilter] = useState('all');

  // Categories list
  const categories = ['Еда', 'Транспорт', 'Развлечения', 'Жилье', 'Одежда', 'Здоровье', 'Гигиена', 'Прочее'];

  // Initialize App
  useEffect(() => {
    initTelegram();
    const token = saveTokenFromUrl();
    
    // If inside Telegram, initData is used automatically. Otherwise check token
    if ((tg && tg.initData) || token || window.location.hostname === 'localhost') {
      setIsAuthenticated(true);
      fetchAllData();
    } else {
      setIsLoading(false);
    }
  }, []);

  // Fetch all data from backend
  const fetchAllData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const headers = getAuthHeaders();
      
      // 1. Profile
      const profileRes = await fetch(`${API_URL}/api/user/profile`, { headers });
      if (!profileRes.ok) throw new Error('Ошибка авторизации');
      const profileData = await profileRes.json();
      setProfile(profileData);
      setUser(profileData.user);

      // 2. Transactions
      const txRes = await fetch(`${API_URL}/api/transactions`, { headers });
      const txData = await txRes.json();
      setTransactions(txData);

      // 3. Subscriptions
      const subRes = await fetch(`${API_URL}/api/subscriptions`, { headers });
      const subData = await subRes.json();
      setSubscriptions(subData);

      // 4. Shopping list
      const shopRes = await fetch(`${API_URL}/api/shopping`, { headers });
      const shopData = await shopRes.json();
      setShoppingList(shopData);
      
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Не удалось загрузить данные. Проверьте соединение.');
      // If error is auth, clear auth state
      if (err.message === 'Ошибка авторизации') {
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Alert message helper
  const showMessage = (msg, type = 'success') => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    }
  };

  // --- API MUTATIONS ---

  // Manually log in as test user (localhost development bypass)
  const handleTestLogin = () => {
    localStorage.setItem('finance_auth_token', 'test_token_123');
    setIsAuthenticated(true);
    fetchAllData();
  };

  // Transactions CRUD
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!txForm.amount || isNaN(txForm.amount) || parseFloat(txForm.amount) <= 0) {
      return showMessage('Введите корректную сумму', 'error');
    }
    
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_URL}/api/transactions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(txForm)
      });
      
      if (!res.ok) throw new Error('Ошибка добавления транзакции');
      
      const newTx = await res.json();
      setTransactions([newTx, ...transactions]);
      
      // Update profile totals
      const amountNum = parseFloat(txForm.amount);
      setProfile(prev => {
        const isInc = txForm.type === 'income';
        return {
          ...prev,
          balance: prev.balance + (isInc ? amountNum : -amountNum),
          totalIncome: prev.totalIncome + (isInc ? amountNum : 0),
          totalExpense: prev.totalExpense + (isInc ? 0 : amountNum)
        };
      });
      
      setShowTxModal(false);
      // Reset form
      setTxForm({ type: 'expense', amount: '', category: 'Еда', description: '', date: new Date().toISOString().slice(0, 10) });
      showMessage('Транзакция успешно добавлена!');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleDeleteTransaction = async (id, amount, type) => {
    if (!window.confirm('Вы действительно хотите удалить эту транзакцию?')) return;
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_URL}/api/transactions/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Ошибка удаления');
      
      setTransactions(transactions.filter(t => t.id !== id));
      
      // Update profile totals
      setProfile(prev => {
        const isInc = type === 'income';
        return {
          ...prev,
          balance: prev.balance - (isInc ? amount : -amount),
          totalIncome: prev.totalIncome - (isInc ? amount : 0),
          totalExpense: prev.totalExpense - (isInc ? 0 : amount)
        };
      });
      showMessage('Транзакция удалена');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // Subscriptions CRUD
  const handleAddSubscription = async (e) => {
    e.preventDefault();
    if (!subForm.name || !subForm.amount || isNaN(subForm.amount)) {
      return showMessage('Заполните обязательные поля корректно', 'error');
    }

    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_URL}/api/subscriptions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(subForm)
      });
      
      if (!res.ok) throw new Error('Ошибка добавления подписки');
      const newSub = await res.json();
      setSubscriptions([...subscriptions, newSub]);
      
      setShowSubModal(false);
      setSubForm({ name: '', amount: '', period: 'monthly', next_payment_date: new Date().toISOString().slice(0, 10) });
      showMessage('Подписка добавлена');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleToggleSubActive = async (id, currentStatus) => {
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const newStatus = currentStatus === 1 ? 0 : 1;
      const res = await fetch(`${API_URL}/api/subscriptions/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ active: newStatus })
      });
      if (!res.ok) throw new Error('Не удалось обновить статус');
      
      setSubscriptions(subscriptions.map(s => s.id === id ? { ...s, active: newStatus } : s));
      showMessage(newStatus === 1 ? 'Подписка возобновлена' : 'Подписка приостановлена');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleDeleteSubscription = async (id) => {
    if (!window.confirm('Удалить эту подписку?')) return;
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_URL}/api/subscriptions/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Ошибка удаления');
      
      setSubscriptions(subscriptions.filter(s => s.id !== id));
      showMessage('Подписка удалена');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // Shopping List CRUD
  const handleAddShoppingItem = async (e) => {
    e.preventDefault();
    if (!shoppingForm.item_name) return showMessage('Введите название товара', 'error');
    
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_URL}/api/shopping`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          item_name: shoppingForm.item_name,
          estimated_price: shoppingForm.estimated_price ? parseFloat(shoppingForm.estimated_price) : 0,
          priority: shoppingForm.priority
        })
      });
      
      if (!res.ok) throw new Error('Ошибка добавления');
      const newItem = await res.json();
      setShoppingList([newItem, ...shoppingList]);
      
      setShowShoppingModal(false);
      setShoppingForm({ item_name: '', estimated_price: '', priority: 'medium' });
      showMessage('Товар добавлен в список покупок');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleBuyShoppingItem = async (id, name, price) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_URL}/api/shopping/${id}/buy`, {
        method: 'POST',
        headers
      });
      if (!res.ok) throw new Error('Ошибка покупки');
      
      // Update shopping list state (mark as bought)
      setShoppingList(shoppingList.map(item => item.id === id ? { ...item, bought: 1 } : item));
      
      // Refetch profile & transactions to get new transaction
      const txRes = await fetch(`${API_URL}/api/transactions`, { headers });
      const txData = await txRes.json();
      setTransactions(txData);
      
      const profileRes = await fetch(`${API_URL}/api/user/profile`, { headers });
      const profileData = await profileRes.json();
      setProfile(profileData);
      
      showMessage(`Товар "${name}" куплен! Расход записан.`);
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleDeleteShoppingItem = async (id) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_URL}/api/shopping/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Ошибка удаления');
      
      setShoppingList(shoppingList.filter(item => item.id !== id));
      showMessage('Товар удален из списка');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // --- STATS CALCULATIONS ---

  // Category breakdown
  const categoryExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  // Convert categories object to sorted array
  const categoryList = Object.keys(categoryExpenses).map(cat => ({
    name: cat,
    value: categoryExpenses[cat],
    color: cat === 'Еда' ? '#3b82f6' : 
           cat === 'Транспорт' ? '#10b981' : 
           cat === 'Развлечения' ? '#ec4899' : 
           cat === 'Жилье' ? '#f59e0b' : 
           cat === 'Одежда' ? '#8b5cf6' : 
           cat === 'Здоровье' ? '#ef4444' : 
           cat === 'Гигиена' ? '#06b6d4' : '#6b7280'
  })).sort((a, b) => b.value - a.value);

  // Weekly stats for simple SVG chart (last 7 days of expenses)
  const getLast7DaysExpenses = () => {
    const expenses = new Array(7).fill(0).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return {
        dateStr: d.toISOString().slice(0, 10),
        dayName: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
        amount: 0
      };
    }).reverse();

    transactions.forEach(t => {
      if (t.type === 'expense') {
        const item = expenses.find(e => e.dateStr === t.date);
        if (item) {
          item.amount += t.amount;
        }
      }
    });

    return expenses;
  };

  const weeklyExpenses = getLast7DaysExpenses();
  const maxWeeklyExpense = Math.max(...weeklyExpenses.map(w => w.amount), 100);

  // Total recurring subscriptions cost
  const totalSubCost = subscriptions
    .filter(s => s.active === 1)
    .reduce((sum, s) => sum + s.amount, 0);

  // Format currency helper
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(val);
  };

  // --- RENDER SCREEN ---

  if (isLoading) {
    return (
      <div className="login-container">
        <div className="glass-panel login-card" style={{ padding: '60px' }}>
          <RefreshCw className="logo-icon animate-spin" style={{ width: '40px', height: '40px', padding: '6px' }} />
          <h2 style={{ marginTop: '20px', fontFamily: 'Outfit' }}>Загрузка финансов...</h2>
        </div>
      </div>
    );
  }

  // Not authenticated screen (Magic Link required or developer mock button)
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="glass-panel login-card">
          <div className="login-icon-large">
            <Lock style={{ width: '36px', height: '36px' }} />
          </div>
          <h1 className="login-title">Личный Финансовый Трекер</h1>
          <p className="login-subtitle">Доступ ограничен. Войдите через Telegram-бота</p>
          
          <div className="login-instruction">
            Напишите нашему боту в Telegram и нажмите кнопку <b>📊 Открыть Dashboard</b>.<br/><br/>
            Или запросите ссылку на ПК с помощью команды <code>/login</code> в чате с ботом.
          </div>

          {/* Dev Bypass Button */}
          <button 
            onClick={handleTestLogin} 
            className="btn btn-primary" 
            style={{ marginTop: '30px', width: '100%' }}
            id="dev-bypass-login"
          >
            Войти как тестовый пользователь (Локально)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar - Desktop */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">
            <Wallet style={{ width: '22px', height: '22px', color: 'white' }} />
          </div>
          <span className="logo-text">Finance Tracker</span>
        </div>

        <ul className="nav-links">
          <li>
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`nav-link-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              id="nav-dashboard"
            >
              <TrendingUp size={20} />
              Панель
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab('transactions')} 
              className={`nav-link-btn ${activeTab === 'transactions' ? 'active' : ''}`}
              id="nav-transactions"
            >
              <ListFilter size={20} />
              Транзакции
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab('subscriptions')} 
              className={`nav-link-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
              id="nav-subscriptions"
            >
              <Calendar size={20} />
              Подписки
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab('shopping')} 
              className={`nav-link-btn ${activeTab === 'shopping' ? 'active' : ''}`}
              id="nav-shopping"
            >
              <ShoppingCart size={20} />
              Покупки
            </button>
          </li>
        </ul>

        {user && (
          <div className="user-profile">
            <div className="user-avatar">
              {user.first_name ? user.first_name[0].toUpperCase() : 'U'}
            </div>
            <div className="user-details">
              <span className="user-name">{user.first_name || 'Пользователь'}</span>
              <span className="user-role">@{user.username || 'telegram'}</span>
            </div>
            <button 
              onClick={logout} 
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', marginLeft: 'auto', cursor: 'pointer' }}
              title="Выйти"
              id="btn-logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </aside>

      {/* Bottom Nav - Mobile */}
      <nav className="mobile-nav">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          id="m-nav-dashboard"
        >
          <TrendingUp />
          <span>Панель</span>
        </button>
        <button 
          onClick={() => setActiveTab('transactions')} 
          className={`mobile-nav-btn ${activeTab === 'transactions' ? 'active' : ''}`}
          id="m-nav-transactions"
        >
          <ListFilter />
          <span>Транзакции</span>
        </button>
        <button 
          onClick={() => setActiveTab('subscriptions')} 
          className={`mobile-nav-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
          id="m-nav-subscriptions"
        >
          <Calendar />
          <span>Подписки</span>
        </button>
        <button 
          onClick={() => setActiveTab('shopping')} 
          className={`mobile-nav-btn ${activeTab === 'shopping' ? 'active' : ''}`}
          id="m-nav-shopping"
        >
          <ShoppingCart />
          <span>Покупки</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Messages */}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {/* --- TAB: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="page-title">
              <h1>Финансовая Панель</h1>
              <button onClick={fetchAllData} className="btn btn-secondary" id="refresh-dashboard">
                <RefreshCw size={16} /> Обновить
              </button>
            </div>

            {/* Metrics */}
            <div className="metrics-grid">
              <div className="glass-panel metric-card balance">
                <div className="metric-header">
                  <span>Общий Баланс</span>
                  <Wallet className="metric-icon" style={{ color: '#c084fc' }} size={20} />
                </div>
                <div className="metric-value">{formatCurrency(profile.balance)}</div>
              </div>

              <div className="glass-panel metric-card income">
                <div className="metric-header">
                  <span>Доходы за месяц</span>
                  <TrendingUp className="metric-icon" style={{ color: '#10b981' }} size={20} />
                </div>
                <div className="metric-value" style={{ color: '#10b981' }}>{formatCurrency(profile.totalIncome)}</div>
              </div>

              <div className="glass-panel metric-card expense">
                <div className="metric-header">
                  <span>Расходы за месяц</span>
                  <TrendingDown className="metric-icon" style={{ color: '#ef4444' }} size={20} />
                </div>
                <div className="metric-value" style={{ color: '#ef4444' }}>{formatCurrency(profile.totalExpense)}</div>
              </div>

              <div className="glass-panel metric-card subscriptions">
                <div className="metric-header">
                  <span>Регулярные подписки</span>
                  <Calendar className="metric-icon" style={{ color: '#f59e0b' }} size={20} />
                </div>
                <div className="metric-value" style={{ color: '#eab308' }}>{formatCurrency(totalSubCost)} <span style={{ fontSize: '14px', color: '#9ca3af' }}>/ мес</span></div>
              </div>
            </div>

            {/* Charts */}
            <div className="charts-grid">
              {/* Daily Bar Chart */}
              <div className="glass-panel chart-card">
                <div className="chart-title">
                  <span>Расходы за последние 7 дней</span>
                  <TrendingDown size={18} style={{ color: 'var(--expense)' }} />
                </div>
                
                {/* SVG Bar Chart */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '10px 10px 0' }}>
                  {weeklyExpenses.map((w, index) => {
                    const pctHeight = maxWeeklyExpense > 0 ? (w.amount / maxWeeklyExpense) * 100 : 0;
                    return (
                      <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%', height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          {w.amount > 0 ? Math.round(w.amount) : ''}
                        </div>
                        {/* Bar */}
                        <div 
                          style={{ 
                            width: '100%', 
                            height: `${Math.max(pctHeight, 3)}%`, 
                            background: w.amount > 0 ? 'linear-gradient(to top, var(--primary), var(--secondary))' : 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '6px 6px 0 0',
                            boxShadow: w.amount > 0 ? '0 0 10px rgba(168, 85, 247, 0.3)' : 'none',
                            transition: 'height 0.5s ease'
                          }} 
                          title={`${w.dateStr}: ${formatCurrency(w.amount)}`}
                        />
                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '8px' }}>
                          {w.dayName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="glass-panel chart-card">
                <div className="chart-title">
                  <span>Категории расходов</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
                  {categoryList.length > 0 ? (
                    categoryList.map((c, i) => {
                      const totalExpensesVal = profile.totalExpense || 1;
                      const percent = ((c.value / totalExpensesVal) * 100).toFixed(0);
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                            <span style={{ fontWeight: '500' }}>{c.name}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(c.value)} ({percent}%)</span>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${percent}%`, backgroundColor: c.color, borderRadius: '4px' }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                      Нет расходов за этот период
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick list of upcoming subscriptions */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', fontFamily: 'Outfit' }}>Ближайшие платежи по подпискам</h2>
              <div className="table-container" style={{ margin: 0 }}>
                {subscriptions.filter(s => s.active === 1).length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Стоимость</th>
                        <th>Период</th>
                        <th>След. платеж</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions
                        .filter(s => s.active === 1)
                        .slice(0, 5)
                        .map(s => (
                          <tr key={s.id}>
                            <td style={{ fontWeight: '600' }}>{s.name}</td>
                            <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatCurrency(s.amount)}</td>
                            <td>{s.period === 'monthly' ? 'Ежемесячно' : 'Ежегодно'}</td>
                            <td style={{ color: 'var(--secondary)', fontWeight: '600' }}>{s.next_payment_date}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Активных подписок не найдено</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB: TRANSACTIONS --- */}
        {activeTab === 'transactions' && (
          <div>
            <div className="page-title">
              <h1>История транзакций</h1>
              <button onClick={() => setShowTxModal(true)} className="btn btn-primary" id="btn-add-tx">
                <Plus size={16} /> Добавить транзакцию
              </button>
            </div>

            {/* Filters */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Тип:</span>
                <select 
                  value={txFilter} 
                  onChange={(e) => setTxFilter(e.target.value)} 
                  className="form-input form-select" 
                  style={{ width: '130px', padding: '8px 12px' }}
                  id="filter-type"
                >
                  <option value="all">Все</option>
                  <option value="income">Доходы</option>
                  <option value="expense">Расходы</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Категория:</span>
                <select 
                  value={txCategoryFilter} 
                  onChange={(e) => setTxCategoryFilter(e.target.value)} 
                  className="form-input form-select" 
                  style={{ width: '160px', padding: '8px 12px' }}
                  id="filter-category"
                >
                  <option value="all">Все категории</option>
                  <option value="Доходы">Доходы</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div className="table-container" style={{ margin: 0 }}>
                {transactions.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Тип</th>
                        <th>Категория</th>
                        <th>Описание</th>
                        <th>Дата</th>
                        <th>Сумма</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions
                        .filter(t => txFilter === 'all' || t.type === txFilter)
                        .filter(t => txCategoryFilter === 'all' || t.category === txCategoryFilter)
                        .map(t => (
                          <tr key={t.id}>
                            <td>
                              <span className={`tx-type-indicator ${t.type}`}>
                                {t.type === 'income' ? 'Доход' : 'Расход'}
                              </span>
                            </td>
                            <td style={{ fontWeight: '500' }}>{t.category}</td>
                            <td>{t.description || '—'}</td>
                            <td>{t.date}</td>
                            <td>
                              <span className={`tx-amount ${t.type}`}>
                                {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                              </span>
                            </td>
                            <td>
                              <button 
                                onClick={() => handleDeleteTransaction(t.id, t.amount, t.type)} 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 10px', color: 'var(--expense)' }}
                                title="Удалить"
                                id={`delete-tx-${t.id}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>Транзакций не найдено</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB: SUBSCRIPTIONS --- */}
        {activeTab === 'subscriptions' && (
          <div>
            <div className="page-title">
              <h1>Мои Подписки</h1>
              <button onClick={() => setShowSubModal(true)} className="btn btn-primary" id="btn-add-sub">
                <Plus size={16} /> Добавить подписку
              </button>
            </div>

            <div className="sub-grid">
              {subscriptions.length > 0 ? (
                subscriptions.map(s => (
                  <div key={s.id} className={`glass-panel sub-card ${s.active === 0 ? 'inactive' : ''}`}>
                    <div className="sub-header">
                      <span className="sub-name">{s.name}</span>
                      <button 
                        onClick={() => handleToggleSubActive(s.id, s.active)} 
                        className={`btn ${s.active === 1 ? 'btn-danger' : 'btn-success'}`}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        id={`toggle-sub-${s.id}`}
                      >
                        {s.active === 1 ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                    </div>

                    <div className="sub-amount">{formatCurrency(s.amount)} <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '400' }}>/ мес</span></div>
                    
                    <div className="sub-details">
                      <div>Период: {s.period === 'monthly' ? 'Ежемесячно' : 'Ежегодно'}</div>
                      <div>След. оплата: <span style={{ color: s.active === 1 ? 'var(--secondary)' : 'var(--text-muted)', fontWeight: '600' }}>{s.next_payment_date}</span></div>
                    </div>

                    <div className="sub-actions">
                      <button 
                        onClick={() => handleDeleteSubscription(s.id)} 
                        className="btn btn-secondary" 
                        style={{ width: '100%', color: 'var(--expense)' }}
                        id={`delete-sub-${s.id}`}
                      >
                        <Trash2 size={14} /> Удалить
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="glass-panel" style={{ padding: '40px', gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Нет подписок. Создайте новую подписку здесь или в боте с помощью /sub!
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB: SHOPPING --- */}
        {activeTab === 'shopping' && (
          <div>
            <div className="page-title">
              <h1>Список покупок</h1>
              <button onClick={() => setShowShoppingModal(true)} className="btn btn-primary" id="btn-add-shop">
                <Plus size={16} /> Добавить покупку
              </button>
            </div>

            <div className="shopping-columns">
              {/* HIGH PRIORITY */}
              <div className="shopping-column">
                <h3 className="column-title high">🔥 Высокий приоритет</h3>
                {shoppingList.filter(i => i.bought === 0 && i.priority === 'high').map(item => (
                  <div key={item.id} className="glass-panel shopping-card">
                    <div className="shopping-item-info">
                      <span className="shopping-item-name">{item.item_name}</span>
                      <span className="shopping-item-price">{item.estimated_price > 0 ? formatCurrency(item.estimated_price) : 'Цена не указана'}</span>
                    </div>
                    <div className="shopping-item-actions">
                      <button 
                        onClick={() => handleBuyShoppingItem(item.id, item.item_name, item.estimated_price)} 
                        className="btn btn-success" 
                        style={{ padding: '6px 10px' }}
                        title="Купить"
                        id={`buy-shop-${item.id}`}
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteShoppingItem(item.id)} 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', color: 'var(--expense)' }}
                        title="Удалить"
                        id={`delete-shop-${item.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* MEDIUM PRIORITY */}
              <div className="shopping-column">
                <h3 className="column-title medium">⚡ Средний приоритет</h3>
                {shoppingList.filter(i => i.bought === 0 && i.priority === 'medium').map(item => (
                  <div key={item.id} className="glass-panel shopping-card">
                    <div className="shopping-item-info">
                      <span className="shopping-item-name">{item.item_name}</span>
                      <span className="shopping-item-price">{item.estimated_price > 0 ? formatCurrency(item.estimated_price) : 'Цена не указана'}</span>
                    </div>
                    <div className="shopping-item-actions">
                      <button 
                        onClick={() => handleBuyShoppingItem(item.id, item.item_name, item.estimated_price)} 
                        className="btn btn-success" 
                        style={{ padding: '6px 10px' }}
                        title="Купить"
                        id={`buy-shop-${item.id}`}
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteShoppingItem(item.id)} 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', color: 'var(--expense)' }}
                        title="Удалить"
                        id={`delete-shop-${item.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* LOW PRIORITY */}
              <div className="shopping-column">
                <h3 className="column-title low">🌱 Низкий приоритет</h3>
                {shoppingList.filter(i => i.bought === 0 && i.priority === 'low').map(item => (
                  <div key={item.id} className="glass-panel shopping-card">
                    <div className="shopping-item-info">
                      <span className="shopping-item-name">{item.item_name}</span>
                      <span className="shopping-item-price">{item.estimated_price > 0 ? formatCurrency(item.estimated_price) : 'Цена не указана'}</span>
                    </div>
                    <div className="shopping-item-actions">
                      <button 
                        onClick={() => handleBuyShoppingItem(item.id, item.item_name, item.estimated_price)} 
                        className="btn btn-success" 
                        style={{ padding: '6px 10px' }}
                        title="Купить"
                        id={`buy-shop-${item.id}`}
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteShoppingItem(item.id)} 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', color: 'var(--expense)' }}
                        title="Удалить"
                        id={`delete-shop-${item.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ALREADY BOUGHT */}
              <div className="shopping-column">
                <h3 className="column-title bought">✅ Куплено</h3>
                {shoppingList.filter(i => i.bought === 1).map(item => (
                  <div key={item.id} className="glass-panel shopping-card bought-item">
                    <div className="shopping-item-info">
                      <span className="shopping-item-name">{item.item_name}</span>
                      <span className="shopping-item-price">{item.estimated_price > 0 ? formatCurrency(item.estimated_price) : ''}</span>
                    </div>
                    <div className="shopping-item-actions">
                      <button 
                        onClick={() => handleDeleteShoppingItem(item.id)} 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', color: 'var(--expense)' }}
                        title="Удалить"
                        id={`delete-shop-${item.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- MODAL: ADD TRANSACTION --- */}
      {showTxModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Новая операция</h2>
              <button onClick={() => setShowTxModal(false)} className="modal-close" id="close-tx-modal">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddTransaction}>
              <div className="form-group">
                <span className="form-label">Тип операции</span>
                <select 
                  value={txForm.type} 
                  onChange={(e) => setTxForm({ ...txForm, type: e.target.value })} 
                  className="form-input form-select"
                  id="form-tx-type"
                >
                  <option value="expense">Расход</option>
                  <option value="income">Доход</option>
                </select>
              </div>

              <div className="form-group">
                <span className="form-label">Сумма (₽)</span>
                <input 
                  type="number" 
                  value={txForm.amount} 
                  onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} 
                  className="form-input" 
                  placeholder="0.00" 
                  required
                  id="form-tx-amount"
                />
              </div>

              <div className="form-group">
                <span className="form-label">Категория</span>
                {txForm.type === 'income' ? (
                  <input type="text" className="form-input" value="Доходы" disabled />
                ) : (
                  <select 
                    value={txForm.category} 
                    onChange={(e) => setTxForm({ ...txForm, category: e.target.value })} 
                    className="form-input form-select"
                    id="form-tx-category"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <span className="form-label">Описание</span>
                <input 
                  type="text" 
                  value={txForm.description} 
                  onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} 
                  className="form-input" 
                  placeholder="Например, Обед в ресторане" 
                  id="form-tx-description"
                />
              </div>

              <div className="form-group">
                <span className="form-label">Дата</span>
                <input 
                  type="date" 
                  value={txForm.date} 
                  onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} 
                  className="form-input" 
                  required
                  id="form-tx-date"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} id="form-tx-submit">
                Добавить
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD SUBSCRIPTION --- */}
      {showSubModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Новая подписка</h2>
              <button onClick={() => setShowSubModal(false)} className="modal-close" id="close-sub-modal">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubscription}>
              <div className="form-group">
                <span className="form-label">Название</span>
                <input 
                  type="text" 
                  value={subForm.name} 
                  onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} 
                  className="form-input" 
                  placeholder="Например, Netflix" 
                  required
                  id="form-sub-name"
                />
              </div>

              <div className="form-group">
                <span className="form-label">Стоимость (₽)</span>
                <input 
                  type="number" 
                  value={subForm.amount} 
                  onChange={(e) => setSubForm({ ...subForm, amount: e.target.value })} 
                  className="form-input" 
                  placeholder="0.00" 
                  required
                  id="form-sub-amount"
                />
              </div>

              <div className="form-group">
                <span className="form-label">Периодичность</span>
                <select 
                  value={subForm.period} 
                  onChange={(e) => setSubForm({ ...subForm, period: e.target.value })} 
                  className="form-input form-select"
                  id="form-sub-period"
                >
                  <option value="monthly">Ежемесячно</option>
                  <option value="yearly">Ежегодно</option>
                </select>
              </div>

              <div className="form-group">
                <span className="form-label">Дата следующего списания</span>
                <input 
                  type="date" 
                  value={subForm.next_payment_date} 
                  onChange={(e) => setSubForm({ ...subForm, next_payment_date: e.target.value })} 
                  className="form-input" 
                  required
                  id="form-sub-date"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} id="form-sub-submit">
                Создать
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD SHOPPING ITEM --- */}
      {showShoppingModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Добавить покупку</h2>
              <button onClick={() => setShowShoppingModal(false)} className="modal-close" id="close-shop-modal">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddShoppingItem}>
              <div className="form-group">
                <span className="form-label">Что нужно купить</span>
                <input 
                  type="text" 
                  value={shoppingForm.item_name} 
                  onChange={(e) => setShoppingForm({ ...shoppingForm, item_name: e.target.value })} 
                  className="form-input" 
                  placeholder="Например, Хлеб" 
                  required
                  id="form-shop-name"
                />
              </div>

              <div className="form-group">
                <span className="form-label">Ориентировочная стоимость (₽)</span>
                <input 
                  type="number" 
                  value={shoppingForm.estimated_price} 
                  onChange={(e) => setShoppingForm({ ...shoppingForm, estimated_price: e.target.value })} 
                  className="form-input" 
                  placeholder="0.00 (необязательно)" 
                  id="form-shop-price"
                />
              </div>

              <div className="form-group">
                <span className="form-label">Приоритет покупки</span>
                <select 
                  value={shoppingForm.priority} 
                  onChange={(e) => setShoppingForm({ ...shoppingForm, priority: e.target.value })} 
                  className="form-input form-select"
                  id="form-shop-priority"
                >
                  <option value="high">Высокий</option>
                  <option value="medium">Средний</option>
                  <option value="low">Низкий</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} id="form-shop-submit">
                Добавить
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
