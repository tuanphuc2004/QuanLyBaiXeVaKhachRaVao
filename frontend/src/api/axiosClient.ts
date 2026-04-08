import axios from "axios";

/**
 * - Production (build): same-origin `/api` → Nginx proxy tới uvicorn.
 * - Dev: gọi trực tiếp backend trên cổng 8000 (khớp `uvicorn ... --port 8000`; LAN qua IP vẫn đúng).
 * - Tuỳ chọn: `VITE_API_BASE_URL` (vd: https://api.example.com/api hoặc /api).
 */
function resolveApiBaseURL(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (import.meta.env.DEV) {
    const host = window.location.hostname;
    return `http://${host}:8000/api`;
  }
  return "/api";
}

const axiosClient = axios.create({
  baseURL: resolveApiBaseURL(),
  headers: {
    "Content-Type": "application/json"
  }
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;
