const isProd = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
const defaultBackend = isProd
    ? (window.location.origin.includes('sketch')
        ? window.location.origin.replace('sketch', 'server')
        : window.location.origin)
    : 'http://localhost:3001';

export const API_BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL || defaultBackend;

