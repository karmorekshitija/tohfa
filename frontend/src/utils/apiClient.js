import axios from 'axios';

// SessionStorage Key Shim for Tohfa compatibility
const originalGetItem = sessionStorage.getItem.bind(sessionStorage);
const originalSetItem = sessionStorage.setItem.bind(sessionStorage);
const originalRemoveItem = sessionStorage.removeItem.bind(sessionStorage);

const KEY_MAP = {
  'access_token': 'tohfa_access_token',
  'refresh_token': 'tohfa_refresh_token',
  'user': 'tohfa_user'
};

sessionStorage.getItem = function(key) {
  const mappedKey = KEY_MAP[key] || key;
  return originalGetItem(mappedKey);
};

sessionStorage.setItem = function(key, value) {
  const mappedKey = KEY_MAP[key] || key;
  originalSetItem(mappedKey, value);
};

sessionStorage.removeItem = function(key) {
  const mappedKey = KEY_MAP[key] || key;
  originalRemoveItem(mappedKey);
};

const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('tohfa_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => error ? prom.reject(error) : prom.resolve(token));
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      const refreshToken = sessionStorage.getItem('tohfa_refresh_token');
      try {
        const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
        sessionStorage.setItem('tohfa_access_token', data.data.access_token);
        processQueue(null, data.data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.data.access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        sessionStorage.clear();
        window.location.href = '/auth/login.html';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
