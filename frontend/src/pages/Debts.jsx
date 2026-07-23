import React, { useEffect, useState } from 'react';

export default function Debts() {
  const [debts, setDebts] = useState([]);
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('owe');
  const [dueDate, setDueDate] = useState('');

  const fetchDebts = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/debts', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setDebts(await res.json());
  };

  useEffect(() => { fetchDebts(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    await fetch('/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ person_name: personName, amount, type, due_date: dueDate })
    });
    setPersonName(''); setAmount(''); fetchDebts();
  };

  const handlePay = async (id) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/debts/${id}/pay`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
    fetchDebts();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Мои Долги</h1>
      </div>
      
      <div className="card">
        <h3>Добавить Долг</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <select value={type} onChange={e => setType(e.target.value)} style={{ width: '200px' }}>
            <option value="owe">Я должен кому-то</option>
            <option value="owed">Мне должны</option>
          </select>
          <input type="text" placeholder="Имя человека" value={personName} onChange={e => setPersonName(e.target.value)} required style={{ flex: 1 }} />
          <input type="number" placeholder="Сумма" value={amount} onChange={e => setAmount(e.target.value)} required style={{ width: '150px' }} />
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '150px' }} title="Дата возврата" />
          <button type="submit">Сохранить</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Кто/Кому</th>
              <th>Тип</th>
              <th>Сумма</th>
              <th>Дата возврата</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {debts.map(d => (
              <tr key={d.id}>
                <td>{d.person_name}</td>
                <td>{d.type === 'owe' ? <span style={{ color: 'var(--danger)' }}>Я должен</span> : <span style={{ color: 'var(--success)' }}>Мне должны</span>}</td>
                <td style={{ fontWeight: 'bold' }}>{d.amount} ₽</td>
                <td>{d.due_date || 'Без срока'}</td>
                <td>{d.status === 'paid' ? '✅ Оплачено' : '⏳ Ожидается'}</td>
                <td>
                  {d.status === 'pending' && (
                    <button className="secondary" onClick={() => handlePay(d.id)}>Отметить оплаченным</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
