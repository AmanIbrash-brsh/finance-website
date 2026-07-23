import React, { useEffect, useState } from 'react';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const fetchTxs = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/transactions', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setTransactions(await res.json());
  };

  useEffect(() => { fetchTxs(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ type, amount, category, description, date })
    });
    setAmount(''); setCategory(''); setDescription(''); fetchTxs();
  };

  const handleDelete = async (id) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/transactions/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    fetchTxs();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Транзакции</h1>
      </div>
      
      <div className="card">
        <h3>Добавить Транзакцию</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <select value={type} onChange={e => setType(e.target.value)} style={{ width: '150px' }}>
            <option value="expense">Расход</option>
            <option value="income">Доход</option>
          </select>
          <input type="number" placeholder="Сумма" value={amount} onChange={e => setAmount(e.target.value)} required style={{ width: '150px' }} />
          <input type="text" placeholder="Категория" value={category} onChange={e => setCategory(e.target.value)} required style={{ width: '200px' }} />
          <input type="text" placeholder="Описание (необязательно)" value={description} onChange={e => setDescription(e.target.value)} style={{ flex: 1 }} />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{ width: '150px' }} />
          <button type="submit">Добавить</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Тип</th>
              <th>Категория</th>
              <th>Описание</th>
              <th>Сумма</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>{tx.type === 'income' ? <span style={{ color: 'var(--success)' }}>Доход</span> : <span style={{ color: 'var(--danger)' }}>Расход</span>}</td>
                <td>{tx.category}</td>
                <td>{tx.description}</td>
                <td style={{ color: tx.type === 'income' ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                  {tx.type === 'income' ? '+' : '-'}{tx.amount} ₽
                </td>
                <td><button className="danger" onClick={() => handleDelete(tx.id)}>Удалить</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
