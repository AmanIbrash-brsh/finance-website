import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/user/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfile();
  }, []);

  if (!data) return <div>Загрузка...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Сводка</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Добро пожаловать, {data.user.first_name || data.user.email}</p>
      </div>

      <div className="dashboard-grid">
        <div className="card stat-card">
          <h3>Текущий Баланс</h3>
          <div className="value">{data.balance.toFixed(2)} ₽</div>
        </div>
        <div className="card stat-card">
          <h3>Всего Доходов</h3>
          <div className="value income">+{data.totalIncome.toFixed(2)} ₽</div>
        </div>
        <div className="card stat-card">
          <h3>Всего Расходов</h3>
          <div className="value expense">-{data.totalExpense.toFixed(2)} ₽</div>
        </div>
      </div>

      <div className="card">
        <h3>Быстрые действия</h3>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <Link to="/transactions"><button>Все Транзакции</button></Link>
          <Link to="/debts"><button className="secondary">Мои Долги</button></Link>
          <Link to="/incomes"><button className="secondary">Регулярные Доходы</button></Link>
        </div>
      </div>
    </div>
  );
}
