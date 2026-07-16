// Telegram WebApp SDK Wrapper

export const tg = window.Telegram?.WebApp || null;

export function initTelegram() {
  if (tg) {
    tg.ready();
    tg.expand();
    console.log('Telegram WebApp SDK initialized');
  } else {
    console.warn('Telegram WebApp SDK not found. Running in browser mode.');
  }
}

export function getTelegramUser() {
  return tg?.initDataUnsafe?.user || null;
}

export function getAuthHeaders() {
  const headers = {};
  
  if (tg && tg.initData) {
    headers['X-Telegram-Init-Data'] = tg.initData;
  }
  
  // Also check if we have a token stored in localStorage (for desktop browser access)
  const token = localStorage.getItem('finance_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

export function saveTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    localStorage.setItem('finance_auth_token', token);
    // Clean up url
    window.history.replaceState({}, document.title, window.location.pathname);
    return token;
  }
  return localStorage.getItem('finance_auth_token');
}

export function logout() {
  localStorage.removeItem('finance_auth_token');
  window.location.reload();
}
