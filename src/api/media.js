import { Platform } from 'react-native';
import { MASTER_BASE } from './config';
import { getToken } from '../auth/session';

// /media/upload lives on master-data-service (port 8091). It takes a
// MultipartFile and returns { url, publicId, source, bytes }. The
// technician detail screen calls this for each photo + each solution
// pack file, then stores the returned URL on the ticket.
export async function uploadMedia({ uri, name, type, folder } = {}) {
  const base = String(MASTER_BASE).replace(/\/$/, '');
  const url = folder ? `${base}/media/upload?folder=${encodeURIComponent(folder)}` : `${base}/media/upload`;
  const form = new FormData();
  const filename = name || 'upload.jpg';
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, filename);
  } else {
    form.append('file', { uri, name: filename, type: type || 'image/jpeg' });
  }
  const token = await getToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    const err = new Error((json && (json.message || json.error)) || text || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}
