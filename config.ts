const isProd = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
const defaultBackend = isProd ? window.location.origin.replace('aura-sketch', 'aura-server') : 'http://localhost:3001';

export const API_BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL || defaultBackend;
