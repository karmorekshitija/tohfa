import axios from 'axios';

const adminApiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Attach admin token to every request
adminApiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('tohfa_admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401/403
adminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      sessionStorage.removeItem('tohfa_admin_token');
      window.location.href = '/admin/login.html';
    }
    return Promise.reject(error);
  }
);

export default adminApiClient;
