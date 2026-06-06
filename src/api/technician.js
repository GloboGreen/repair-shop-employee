import { ticketApi } from './client';

// All technician endpoints live on the ticket-service (port 8082) under
// /technicians — so we reuse ticketApi which already targets that base.

export async function getMyTechnicianProfile() {
  return ticketApi.get('/technicians/me');
}

export async function getTodayAttendance() {
  // Backend returns 204 No Content when there's no record for today.
  // ticketApi's request() returns null for empty bodies, so callers see null.
  return ticketApi.get('/technicians/me/attendance/today', { skipAuthExpiry: true });
}

export async function getMonthlyAttendance(technicianId, month, year) {
  return ticketApi.get(`/technicians/${technicianId}/attendance`, { query: { month, year } });
}

export async function getMyLeaves(technicianId, { month, year } = {}) {
  return ticketApi.get(`/technicians/${technicianId}/leaves`, { query: { month, year } });
}

export async function checkIn(notes) {
  return ticketApi.post('/technicians/me/attendance/check-in', { body: notes ? { notes } : {} });
}

export async function checkOut(notes) {
  return ticketApi.post('/technicians/me/attendance/check-out', { body: notes ? { notes } : {} });
}
