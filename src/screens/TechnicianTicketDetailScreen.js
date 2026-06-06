import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Smartphone, Camera, Search, UploadCloud, Pencil, X, Check,
} from 'lucide-react-native';
import {
  getTicket, setTechnicianPhotos, addRepairNote, listRepairNotes,
  listTicketEvents, postProgressEvent,
} from '../api/tickets';
import { uploadMedia } from '../api/media';
import { notify } from '../components/confirm';

// Service Progress checklist rows shown above the Issue Reference buttons.
// Submitting a row POSTs /tickets/{id}/progress-events; the matching
// repair_booking_events row lights up on the customer/owner timeline. Order
// here follows the bottom half of SHOP_BOOKING_STATUS_OPTIONS in the mobile
// timeline.
const PROGRESS_ROWS = [
  { key: 'IN_REPAIR',               label: 'Repair Work In Progress' },
  { key: 'PARTS_REQUIRED',          label: 'Parts Required' },
  { key: 'PARTS_REPLACED',          label: 'Parts Replaced' },
  { key: 'QUALITY_CHECK_STARTED',   label: 'Quality Check Started' },
  { key: 'QUALITY_CHECK_COMPLETED', label: 'Quality Check Completed' },
  { key: 'REPAIR_COMPLETED',        label: 'Repair Completed' },
];

function parseJsonArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// devicePhotosJson uses the {front, back, video} object form (the booking
// mirror writes it that way); technicianPhotosJson is a plain ["url", ...]
// array. Normalize both into a flat URL list ordered front → back → video.
function parseDevicePhotos(raw) {
  if (!raw) return [];
  let v = raw;
  if (typeof raw === 'string') {
    try { v = JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(v)) return v.map(photoUrl).filter(Boolean);
  if (v && typeof v === 'object') {
    return ['front', 'back', 'video']
      .map((k) => photoUrl(v[k]))
      .filter(Boolean);
  }
  return [];
}

// devicePhotosJson can be ["url", ...] or [{ url }, ...]. Normalize.
function photoUrl(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.url || item.uri || item.imageUrl || null;
}

export default function TechnicianTicketDetailScreen({ route, navigation }) {
  const { ticketId } = route.params || {};

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Your-Side photos: { uri, remoteUrl } — uri is local until uploaded.
  const [yourPhotos, setYourPhotos] = useState([null, null, null]);
  const [photosSubmitting, setPhotosSubmitting] = useState(false);
  // After upload, slots render read-only; +Edit re-enables picking/removing.
  const [photosEditing, setPhotosEditing] = useState(false);


  const [note, setNote] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [notesList, setNotesList] = useState([]);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const t = await getTicket(ticketId);
      setTicket(t);
      const existing = parseJsonArray(t?.technicianPhotosJson).map(photoUrl).filter(Boolean);
      const slots = [null, null, null];
      existing.slice(0, 3).forEach((url, i) => { slots[i] = { uri: url, remoteUrl: url }; });
      setYourPhotos(slots);
      // If any photo was already uploaded, default to read-only view.
      setPhotosEditing(existing.length === 0);
      setError(null);
    } catch (e) {
      setError(e?.message || 'Could not load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  // Pull existing compliance notes so the list under Submit shows what's
  // already been recorded for this ticket.
  const refreshNotes = useCallback(async () => {
    if (!ticketId) return;
    try {
      const rows = await listRepairNotes(ticketId);
      setNotesList(Array.isArray(rows) ? rows : []);
    } catch { setNotesList([]); }
  }, [ticketId]);

  useEffect(() => { refreshNotes(); }, [refreshNotes]);

  // Service Progress checklist state.
  // - `progressChecked` is the local tick state for each row (user is about
  //   to submit). Submit clears the tick because the row's "done" state then
  //   comes from `progressDone` which is sourced from backend events.
  // - `progressDone` is the persisted set of step keys that already have
  //   matching events on this ticket — the row renders with a green tick.
  // - `progressBusy` is the row currently being POSTed so we can disable it.
  const [progressChecked, setProgressChecked] = useState({});
  const [progressDone, setProgressDone] = useState({});
  const [progressBusy, setProgressBusy] = useState(null);

  const refreshProgress = useCallback(async () => {
    if (!ticketId) return;
    try {
      const rows = await listTicketEvents(ticketId);
      const done = {};
      // Only pre-tick rows the TECHNICIAN explicitly submitted. Auto-emitted
      // macro-status events (actor=SHOP / SYSTEM) leave the checkbox empty
      // so the technician still has to take the action manually.
      (Array.isArray(rows) ? rows : []).forEach((e) => {
        const k = (e.status || '').toUpperCase();
        const actor = (e.actor || '').toUpperCase();
        if (actor === 'TECHNICIAN' && PROGRESS_ROWS.some((r) => r.key === k)) {
          done[k] = true;
        }
      });
      setProgressDone(done);
    } catch { /* keep current */ }
  }, [ticketId]);

  useEffect(() => { refreshProgress(); }, [refreshProgress]);

  const submitProgress = useCallback(async (row) => {
    if (!progressChecked[row.key] && !progressDone[row.key]) {
      notify('Tick the box first', `Check "${row.label}" before submitting.`);
      return;
    }
    setProgressBusy(row.key);
    try {
      await postProgressEvent(ticketId, { statusKey: row.key });
      setProgressChecked((prev) => ({ ...prev, [row.key]: false }));
      refreshProgress();
      notify('Saved', `"${row.label}" recorded.`);
    } catch (e) {
      notify('Save failed', e?.message || 'Try again');
    } finally {
      setProgressBusy(null);
    }
  }, [ticketId, progressChecked, progressDone, refreshProgress]);


  const devicePhotos = useMemo(
    () => parseDevicePhotos(ticket?.devicePhotosJson),
    [ticket?.devicePhotosJson],
  );

  // ---------- Your-Side photo picker + submit ----------

  const pickPhoto = async (index) => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify('Permission required', 'Allow photo library access to upload device images.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setYourPhotos((prev) => {
      const next = [...prev];
      next[index] = { uri: asset.uri, remoteUrl: null, name: asset.fileName, type: asset.mimeType };
      return next;
    });
  };

  const removePhoto = (index) => {
    setYourPhotos((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const submitPhotos = async () => {
    setPhotosSubmitting(true);
    try {
      const uploaded = [];
      for (const slot of yourPhotos) {
        if (!slot) continue;
        if (slot.remoteUrl) { uploaded.push(slot.remoteUrl); continue; }
        const res = await uploadMedia({
          uri: slot.uri, name: slot.name || 'tech-photo.jpg', type: slot.type || 'image/jpeg',
          folder: `tickets/${ticketId}/technician`,
        });
        const url = res?.url || res?.secure_url || null;
        // Don't silently drop a photo: a missing URL on a 200 response usually
        // means a misconfigured Cloudinary fallback — surface it so the user
        // knows the photo wasn't actually saved.
        if (!url) throw new Error('Upload returned no URL');
        uploaded.push(url);
      }
      await setTechnicianPhotos(ticketId, uploaded);
      // Update slots from the URLs we just persisted instead of refetching —
      // this avoids a flicker (and avoids the appearance of "lost" photos if a
      // stale GET races the write). useFocusEffect / next mount will reconcile.
      const nextSlots = [null, null, null];
      uploaded.slice(0, 3).forEach((u, i) => { nextSlots[i] = { uri: u, remoteUrl: u }; });
      setYourPhotos(nextSlots);
      setPhotosEditing(uploaded.length === 0);
      notify('Saved', 'Your device images have been uploaded.');
    } catch (e) {
      notify('Upload failed', e?.message || 'Could not save photos');
    } finally {
      setPhotosSubmitting(false);
    }
  };

  // ---------- Compliance note submit ----------

  const submitNote = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setNoteSubmitting(true);
    try {
      await addRepairNote(ticketId, { note: trimmed });
      setNote('');
      // Backend emits TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED on note
      // submit; re-pull the notes list so the freshly-saved note shows under
      // Submit. The timeline rail on the owner/customer side updates on its
      // own refresh from the backend event we just emitted.
      refreshNotes();
      notify('Note added', 'Your compliance note has been saved.');
    } catch (e) {
      notify('Could not save note', e?.message || 'Try again');
    } finally {
      setNoteSubmitting(false);
    }
  };

  // ---------- Solution pack: navigate to full-screen forms ----------

  // Defaults carry the ticket's brand/model/issue into the new screens so the
  // technician doesn't re-enter them. The reference screen treats null filters
  // as "match-any" so omissions widen the search rather than empty it.
  const solutionPackDefaults = useMemo(() => ({
    brand: ticket?.brandId ? { id: ticket.brandId, name: ticket.brandName } : null,
    model: ticket?.modelId ? { id: ticket.modelId, name: ticket.modelName } : null,
    issueCategory: null,
    issueSubcategory: null,
  }), [ticket?.brandId, ticket?.modelId, ticket?.brandName, ticket?.modelName]);

  const openReferenceView = () => {
    navigation.navigate('SolutionPackReferenceView', { ticketId, defaults: solutionPackDefaults });
  };

  const openUploadScreen = () => {
    navigation.navigate('SolutionPackUpload', { ticketId, defaults: solutionPackDefaults });
  };

  if (loading && !ticket) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#00008B" />
      </View>
    );
  }

  if (error || !ticket) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-danger font-bold mb-2">Ticket not found</Text>
        <Text className="text-text-muted text-[12px] text-center">{error || 'Try again from the task list.'}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Device info card */}
        <View className="bg-card rounded-xl p-3 flex-row items-center mb-3">
          {ticket.deviceImageUrl ? (
            <Image source={{ uri: ticket.deviceImageUrl }} style={{ width: 44, height: 60, borderRadius: 6 }} />
          ) : (
            <View style={{ width: 44, height: 60 }} className="bg-background rounded-md items-center justify-center">
              <Smartphone size={20} color="#9CA3AF" />
            </View>
          )}
          <View className="flex-1 ml-3">
            <Text className="text-[12px] text-text">
              <Text className="text-text-muted">Device Model: </Text>
              <Text className="font-bold">{ticket.deviceDisplayName || '—'}</Text>
            </Text>
            <Text className="text-[12px] text-text mt-1">
              <Text className="text-text-muted">Compliance : </Text>
              <Text className="text-danger font-bold">{ticket.repairServicesSummary || '—'}</Text>
            </Text>
          </View>
        </View>

        {/* Device Image — customer-side photos */}
        <View className="flex-row items-center mb-2">
          <Smartphone size={16} color="#0F172A" />
          <Text className="text-[14px] font-extrabold text-text ml-2">Device Image</Text>
        </View>
        <View
          className="rounded-xl px-3 py-3 mb-4"
          style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: '#A5B4FC', backgroundColor: '#FFFFFF' }}
        >
          {devicePhotos.length === 0 ? (
            <Text className="text-text-muted text-[12px] text-center py-4">No device images attached yet.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row">
                {devicePhotos.map((url, i) => (
                  <Image key={i} source={{ uri: url }} style={{ width: 80, height: 90, borderRadius: 8, marginRight: 8 }} />
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Your-Side Upload */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <Smartphone size={16} color="#0F172A" />
            <Text className="text-[14px] font-extrabold text-text ml-2">Your Side Device Image Upload</Text>
          </View>
          {!photosEditing && yourPhotos.some((s) => s?.remoteUrl) ? (
            <TouchableOpacity
              onPress={() => setPhotosEditing(true)}
              className="flex-row items-center rounded-lg px-3 py-1.5"
              style={{ backgroundColor: '#7C3AED' }}
            >
              <Pencil size={12} color="#FFFFFF" />
              <Text className="text-white text-[11px] font-bold ml-1">Edit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View className="flex-row mb-2 -mx-1">
          {yourPhotos.map((slot, i) => (
            <View key={i} className="flex-1 px-1">
              <Pressable
                onPress={() => (photosEditing && !slot ? pickPhoto(i) : null)}
                className="rounded-xl items-center justify-center"
                style={{
                  borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1',
                  backgroundColor: '#FFFFFF', height: 90,
                }}
              >
                {slot ? (
                  <View className="w-full h-full">
                    <Image source={{ uri: slot.uri }} style={{ width: '100%', height: '100%', borderRadius: 10 }} />
                    {photosEditing ? (
                      <TouchableOpacity
                        onPress={() => removePhoto(i)}
                        hitSlop={8}
                        style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12 }}
                      >
                        <X size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  <View className="items-center px-2">
                    <Camera size={18} color="#94A3B8" />
                    <Text className="text-[9px] text-text-muted text-center mt-1">Take a photo of the device</Text>
                  </View>
                )}
              </Pressable>
            </View>
          ))}
        </View>
        {photosEditing ? (
          <View className="items-center mb-5">
            <TouchableOpacity
              onPress={submitPhotos}
              disabled={photosSubmitting}
              className="rounded-xl"
              style={{ backgroundColor: '#22C55E', paddingHorizontal: 32, paddingVertical: 9, opacity: photosSubmitting ? 0.6 : 1 }}
            >
              {photosSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white font-bold text-[12px]">Submit</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View className="mb-5" />
        )}

        {/* Technician Work Status row removed — the same value is already
            shown as the heading above each action form (e.g. "Technician
            Compliance Issue Verified & Updated" above the notes textarea),
            so the standalone label was duplicative. */}

        {/* Compliance Notes — heading matches the work-status label this
            action advances the timeline to. */}
        <Text className="text-[13px] font-bold text-text mb-1">
          Technician Compliance Issue Verified & Updated
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Enter your Notes"
          placeholderTextColor="#94A3B8"
          className="bg-card rounded-md px-3 py-2 text-[12px] text-text"
          style={{ borderWidth: 1, borderColor: '#CBD5E1', minHeight: 44, textAlignVertical: 'top' }}
        />
        <View className="items-center mt-3 mb-3">
          <TouchableOpacity
            onPress={submitNote}
            disabled={noteSubmitting || !note.trim()}
            className="rounded-xl"
            style={{ backgroundColor: '#22C55E', paddingHorizontal: 32, paddingVertical: 9, opacity: noteSubmitting || !note.trim() ? 0.6 : 1 }}
          >
            {noteSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white font-bold text-[12px]">Submit</Text>}
          </TouchableOpacity>
        </View>

        {/* Submitted compliance notes — listed under Submit so the technician
            can re-read what they've recorded for this ticket. */}
        {notesList.length > 0 ? (
          <View className="bg-card rounded-md p-3 mb-4" style={{ borderWidth: 1, borderColor: '#E2E8F0' }}>
            {notesList.slice(0, 5).map((n) => (
              <View key={n.id} className="mb-2">
                <Text className="text-[12px] text-text">{n.note}</Text>
                <Text className="text-[10px] text-text-muted mt-0.5">
                  {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Service Progress checklist — each row emits a step event on
            Submit so the customer/owner timeline rail lights up that step. */}
        <Text className="text-[13px] font-bold text-text mb-2">Service Progress</Text>
        <View
          className="bg-card rounded-md mb-5 overflow-hidden"
          style={{ borderWidth: 1, borderColor: '#E2E8F0' }}
        >
          <View className="flex-row" style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 6 }}>
            <Text className="text-[10px] font-bold text-text-muted" style={{ width: 28 }}>S.No</Text>
            <Text className="text-[10px] font-bold text-text-muted flex-1">Status</Text>
            <Text className="text-[10px] font-bold text-text-muted" style={{ width: 40, textAlign: 'center' }}>Tick</Text>
            <Text className="text-[10px] font-bold text-text-muted" style={{ width: 64, textAlign: 'center' }}>Action</Text>
          </View>
          {PROGRESS_ROWS.map((row, idx) => {
            const checked = !!progressChecked[row.key];
            const done = !!progressDone[row.key];
            const busy = progressBusy === row.key;
            return (
              <View
                key={row.key}
                className="flex-row items-center"
                style={{
                  paddingHorizontal: 8, paddingVertical: 8,
                  borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#F1F5F9',
                  backgroundColor: done ? '#F0FDF4' : '#FFFFFF',
                }}
              >
                <Text className="text-[11px] text-text" style={{ width: 28 }}>{idx + 1}</Text>
                <Text className={`text-[12px] flex-1 ${done ? 'font-bold' : ''} text-text`}>{row.label}</Text>
                <View style={{ width: 40, alignItems: 'center' }}>
                  <Pressable
                    onPress={() => setProgressChecked((prev) => ({ ...prev, [row.key]: !prev[row.key] }))}
                    style={{
                      width: 20, height: 20, borderRadius: 4,
                      borderWidth: 1.5,
                      borderColor: checked || done ? '#22C55E' : '#94A3B8',
                      backgroundColor: checked || done ? '#22C55E' : '#FFFFFF',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {(checked || done) ? <Check size={14} color="#FFFFFF" /> : null}
                  </Pressable>
                </View>
                <View style={{ width: 64, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => submitProgress(row)}
                    disabled={busy}
                    className="rounded-md"
                    style={{
                      backgroundColor: '#22C55E', paddingHorizontal: 10, paddingVertical: 5,
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {busy
                      ? <ActivityIndicator color="#FFFFFF" size="small" />
                      : <Text className="text-white text-[10px] font-bold">Submit</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Solution Pack section */}
        <Text className="text-[13px] font-bold text-text mb-2">Issue Reference & New Issue Solution Upload</Text>
        <View className="flex-row -mx-1">
          <View className="flex-1 px-1">
            <TouchableOpacity
              onPress={openReferenceView}
              className="rounded-xl flex-row items-center justify-center"
              style={{ backgroundColor: '#3B82F6', paddingVertical: 14 }}
            >
              <View className="bg-white/20 rounded-full p-1.5 mr-2">
                <Search size={14} color="#FFFFFF" />
              </View>
              <Text className="text-white font-bold text-[12px]" numberOfLines={2}>
                Issue Reference Solution Pack View
              </Text>
            </TouchableOpacity>
          </View>
          <View className="flex-1 px-1">
            <TouchableOpacity
              onPress={openUploadScreen}
              className="rounded-xl flex-row items-center justify-center"
              style={{ backgroundColor: '#7C3AED', paddingVertical: 14 }}
            >
              <View className="bg-white/20 rounded-full p-1.5 mr-2">
                <UploadCloud size={14} color="#FFFFFF" />
              </View>
              <Text className="text-white font-bold text-[12px]" numberOfLines={2}>
                New Issue Solution Pack Upload
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
