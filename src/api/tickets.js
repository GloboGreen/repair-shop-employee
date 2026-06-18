import { ticketApi } from './client';

// `assignedToMe=true` is honored by ticket-service's TicketController#list —
// it ignores the status param in that branch, so any status filter is
// applied client-side after the fetch.
export async function listMyTickets({ page = 0, size = 20 } = {}) {
  return ticketApi.get('/tickets', { query: { assignedToMe: true, page, size } });
}

export async function getTicket(ticketId) {
  return ticketApi.get(`/tickets/${ticketId}`);
}

// Technician's explicit Accept. Backend sets tickets.technician_accepted_at
// to now() and emits TECHNICIAN_ACCEPTED_SERVICE + TECHNICIAN_WORK_STARTED
// to the customer/owner timeline. Walk-in tickets at CREATED also have their
// status bumped to IN_DIAGNOSIS server-side. Idempotent.
export async function acceptTicket(ticketId) {
  return ticketApi.post(`/tickets/${ticketId}/accept`);
}

// Booking timeline for a ticket, used by the Ticket Detail screen to derive
// the current work-status dropdown label from the most recently emitted event.
export async function listTicketEvents(ticketId) {
  return ticketApi.get(`/tickets/${ticketId}/events`);
}

// Manual emit for the Service Progress checklist on the Ticket Detail screen.
// statusKey must be one of the allowlist on the backend (IN_REPAIR,
// PARTS_REQUIRED, PARTS_REPLACED, QUALITY_CHECK_STARTED,
// QUALITY_CHECK_COMPLETED, REPAIR_COMPLETED). The backend treats re-submits
// as a refresh of the existing row's note + timestamp.
export async function postProgressEvent(ticketId, { statusKey, note } = {}) {
  return ticketApi.post(`/tickets/${ticketId}/progress-events`, {
    body: { statusKey, note },
  });
}

// Backend TicketService#patch accepts a generic Map; sending technicianPhotosJson
// as a stringified JSON array is the same shape devicePhotosJson uses.
export async function setTechnicianPhotos(ticketId, photoUrls) {
  return ticketApi.patch(`/tickets/${ticketId}`, {
    body: { technicianPhotosJson: JSON.stringify(photoUrls || []) },
  });
}

export async function addRepairNote(
  ticketId,
  { note, isInternal, audioUrl, imageUrls } = {},
) {
  return ticketApi.post(`/tickets/${ticketId}/notes`, {
    body: { note, isInternal, audioUrl, imageUrls },
  });
}

export async function listRepairNotes(ticketId) {
  return ticketApi.get(`/tickets/${ticketId}/notes`);
}

export async function listSolutionPacks(ticketId, { packType } = {}) {
  return ticketApi.get(`/tickets/${ticketId}/solution-packs`, { query: { packType } });
}

export async function createSolutionPack(ticketId, payload) {
  return ticketApi.post(`/tickets/${ticketId}/solution-packs`, { body: payload });
}

// Shop-wide search backing the "Issue Reference Solution Pack View" screen.
// Any of the filters may be omitted; the backend treats null as match-any.
export async function searchSolutionPacks({ packType, brandId, modelId, issueCategory, issueSubcategory } = {}) {
  return ticketApi.get('/solution-packs/search', {
    query: { packType, brandId, modelId, issueCategory, issueSubcategory },
  });
}
