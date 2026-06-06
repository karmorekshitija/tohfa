import apiClient from './apiClient.js';

export function logout() {
  const refreshToken = sessionStorage.getItem('tohfa_refresh_token');
  // Fire and forget, do NOT wait for response
  apiClient.post('/auth/logout', { refresh_token: refreshToken })
    .catch(err => console.error("Logout request failed:", err));
  
  sessionStorage.removeItem('tohfa_access_token');
  sessionStorage.removeItem('tohfa_refresh_token');
  sessionStorage.removeItem('tohfa_user');
  sessionStorage.removeItem('tohfa_admin_token');
  
  window.location.href = '/auth/login.html';
}

window.logout = logout;
