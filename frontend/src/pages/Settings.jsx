import React, { useState } from 'react';

export default function Settings() {
  const [code, setCode] = useState('');

  const generateCode = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/auth/generate-link-code', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setCode(data.code);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Настройки</h1>
      </div>
      
      <div className="card">
        <h3>Привязка Telegram</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', maxWidth: '600px' }}>
          Чтобы получать уведомления о подписках и долгах, привяжите свой аккаунт к Telegram-боту.
          Нажмите кнопку ниже, чтобы сгенерировать временный код, и отправьте его боту.
        </p>
        
        <button onClick={generateCode}>Сгенерировать код</button>
        
        {code && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0, 122, 204, 0.1)', border: '1px solid var(--accent-color)', borderRadius: '6px' }}>
            <p>Ваш код привязки:</p>
            <h2 style={{ letterSpacing: '2px', color: 'var(--accent-color)', margin: '0.5rem 0' }}>{code}</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Скопируйте этот код и отправьте боту команду: <br/>
              <code style={{ background: 'var(--bg-primary)', padding: '0.2rem 0.4rem', borderRadius: '4px', marginTop: '0.5rem', display: 'inline-block' }}>/link {code}</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
