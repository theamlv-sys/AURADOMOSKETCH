import { Capacitor } from '@capacitor/core';

// In Capacitor Native, we always pipe to production since the local Mac Node server isn't running.
// In Web Production, we use empty string so fetch() naturally uses the same domain.
// In Web Local Dev, we use localhost:3001 for local isolated proxy testing.

const isNative = Capacitor.isNativePlatform();
const isProd = typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('192.168');

const defaultBackend = isNative 
    ? 'https://auradomosketch.com' 
    : (isProd ? '' : 'http://localhost:3001');

export const API_BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL || defaultBackend;
