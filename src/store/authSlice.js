import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  accessToken: null,
  userId: null,
  shopId: null,
  shopSlug: null,
  roles: [],
  email: null,
  fullName: null,
  mobile: null,
  // Populated after HomeScreen fetches /technicians/me. These power the
  // role-based Categories grid (roleLabel is the only reliable signal
  // for Pickup Person vs Technician — see project memory) and the
  // attendance/leave calls keyed by the technician's row id.
  roleLabel: null,
  technicianId: null,
  photoUrl: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action) {
      const s = action.payload || {};
      state.accessToken = s.accessToken ?? null;
      state.userId = s.userId ?? null;
      state.shopId = s.shopId ?? null;
      state.shopSlug = s.shopSlug ?? null;
      state.roles = Array.isArray(s.roles) ? s.roles : [];
      state.email = s.email ?? null;
      state.fullName = s.fullName ?? null;
      state.mobile = s.mobile ?? null;
      state.roleLabel = s.roleLabel ?? state.roleLabel ?? null;
      state.technicianId = s.technicianId ?? state.technicianId ?? null;
      state.photoUrl = s.photoUrl ?? state.photoUrl ?? null;
    },
    mergeTechnicianProfile(state, action) {
      const t = action.payload || {};
      if (t.id) state.technicianId = t.id;
      if (t.roleLabel) state.roleLabel = t.roleLabel;
      if (t.name && !state.fullName) state.fullName = t.name;
      if (t.email && !state.email) state.email = t.email;
      if (t.phone && !state.mobile) state.mobile = t.phone;
      if (t.photoUrl) state.photoUrl = t.photoUrl;
      // Duty roster times — drive the "CHECK IN / CHECK OUT" pills on the home
      // header. Stored even when null so a profile update can clear them.
      state.defaultCheckIn = t.defaultCheckIn ?? state.defaultCheckIn ?? null;
      state.defaultCheckOut = t.defaultCheckOut ?? state.defaultCheckOut ?? null;
    },
    clearSession() {
      return initialState;
    },
  },
});

export const { setSession, mergeTechnicianProfile, clearSession } = authSlice.actions;

export const selectSession = (state) => state.auth;
export const selectShopId = (state) => state.auth.shopId;
export const selectUserId = (state) => state.auth.userId;
export const selectRoles = (state) => state.auth.roles;
export const selectAccessToken = (state) => state.auth.accessToken;
export const selectIsLoggedIn = (state) => !!state.auth.accessToken;
export const selectTechnicianId = (state) => state.auth.technicianId;

export default authSlice.reducer;
