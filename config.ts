import { Capacitor } from '@capacitor/core';

// Ensure localhost works natively when not in true production
const isProd = typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('192.168') && !Capacitor.isNativePlatform();

const defaultBackend = isProd
    ? (window.location.origin.includes('sketch')
        ? window.location.origin.replace('sketch', 'server')
        : window.location.origin)
    : 'http://192.168.1.87:3001'; // <-- Force physical LAN routing for iOS Simulator WebView

export const API_BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL || defaultBackend;

