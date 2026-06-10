import Constants from 'expo-constants';
import { Platform } from 'react-native';

function normalizeHost(value) {
  if (!value || typeof value !== 'string') return null;
  let raw = value.trim();
  if (!raw) return null;
  raw = raw.replace(/^exp:\/\//i, '').replace(/^https?:\/\//i, '');
  raw = raw.split('/')[0];
  raw = raw.split(':')[0];
  if (!raw || raw === '[object Object]') return null;
  return raw;
}

function expoDevHost() {
  return normalizeHost(Constants.expoConfig?.hostUri)
    || normalizeHost(Constants.manifest2?.extra?.expoClient?.hostUri)
    || normalizeHost(Constants.manifest?.debuggerHost)
    || normalizeHost(Constants.linkingUri);
}

const explicitHost = normalizeHost(process.env.EXPO_PUBLIC_API_HOST)
  || normalizeHost(Constants.expoConfig?.extra?.API_HOST);

const host = explicitHost
  || (Platform.OS === 'web' ? 'localhost' : expoDevHost())
  || 'localhost';

function baseUrl(port) {
  return `http://${host}:${port}/`;
}

export const AUTH_BASE    = baseUrl(8081);
export const TICKET_BASE  = baseUrl(8082);
export const USER_BASE    = baseUrl(8083);
export const SHOP_BASE    = baseUrl(8084);
export const TECHNICIAN_BASE = baseUrl(8085);
export const MASTER_BASE  = baseUrl(8091);
export const ORDER_BASE   = baseUrl(8092);
