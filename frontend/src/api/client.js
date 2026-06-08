import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000
});

// Injeta token em todas as requisições
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('cora_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Redireciona para login se 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cora_token');
      localStorage.removeItem('cora_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
