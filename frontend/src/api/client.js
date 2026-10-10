import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use(config => {
  const token = sessionStorage.getItem("loomsenseToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
client.interceptors.response.use(r => r, error => {
  if (error.response?.status === 401 && !error.config.url.includes("/auth/login")) window.dispatchEvent(new Event("session-expired"));
  return Promise.reject(error);
});

/** For public pages (buyer tracking): never sends the manager session token, never triggers the login redirect. */
export const publicClient = axios.create({ baseURL: API_URL });
export default client;
