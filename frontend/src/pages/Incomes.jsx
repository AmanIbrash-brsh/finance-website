import React, { useEffect, useState } from 'react';

export default function Incomes() {
  const [incomes, setIncomes] = useState([]);
  const [sourceName, setSourceName] = useState('');
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1');

  const fetchIncomes = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/incomes', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setIncomes(await res.json());
  };

  useEffect(() => { fetchIncomes(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    await fetch('/api/incomes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ source_name: sourceName, amount, day_of_month: dayOfMonth })
    });
    setSourceName(''); setAmount(''); fetchIncomes();
  };

  const handleDelete = async (id) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/incomes/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    fetchIncomes();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Регулярные Доходы</h1>
      </div>
      
      <div className="card">
        <h3>Добавить Зарплату / Регулярный доход</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Укажите день месяца, и система будет автоматически начислять эту сумму каждый месяц.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input type="text" placeholder="Источник (напр. Зарплата)" value={sourceName} onChange={e => setSourceName(e.target.value)} required style={{ flex: 1 }} />
          <input type="number" placeholder="Сумма" value={amount} onChange={e => setAmount(e.target.value)} required style={{ width: '150px' }} />
          <input type="number" min="1" max="31" placeholder="День месяца" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} required style={{ width: '150px' }} title="День месяца (1-31)" />
          <button type="submit">Добавить</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Источник</th>
              <th>Сумма</th>
              <th>День начисления</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {incomes.map(inc => (
              <tr key={inc.id}>
                <td>{inc.source_name}</td>
                <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>+{inc.amount} ₽</td>
                <td>{inc.day_of_month} число</td>
                <td><button className="danger" onClick={() => handleDelete(inc.id)}>Удалить</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
