const host = process.env.EXPO_PUBLIC_API_HOST || 'localhost';

function baseUrl(port) {
  return `http://${host}:${port}/`;
}

export const AUTH_BASE    = baseUrl(8081);
export const TICKET_BASE  = baseUrl(8082);
export const USER_BASE    = baseUrl(8083);
export const SHOP_BASE    = baseUrl(8084);
export const TECHNICIAN_BASE = baseUrl(8085);
export const MASTER_BASE  = baseUrl(8091);
