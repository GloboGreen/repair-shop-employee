import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import {
  Smartphone, Search, UploadCloud, Pencil, X, Check,
  Mic, Play, Pause, Trash2, Plus, Image as ImageIcon,
  ShieldCheck, PackageX, Square,
} from 'lucide-react-native';
import {
  getTicket, setTechnicianPhotos, addRepairNote, listRepairNotes,
  listTicketEvents, postProgressEvent,
} from '../api/tickets';
import { uploadMedia } from '../api/media';
import { notify } from '../components/confirm';

// Service Progress checklist rows shown above the Issue Reference buttons.
// Submitting a row POSTs /tickets/{id}/progress-events; the matching
// repair_booking_events row lights up on the customer/owner timeline. Labels
// + order mirror the canonical SHOP_BOOKING_STATUS_OPTIONS list in
// serviceHistoryPhases.js — anything the technician can directly emit
// appears here, in the same order the timeline renders. Status keys stay
// on their current DB values (rename ships separately with a migration).
const PROGRESS_ROWS = [
  { key: 'IN_REPAIR',               label: 'Repair Work In Progress' },
  { key: 'PARTS_REQUIRED',          label: 'Spare Parts Waiting' },
  { key: 'PARTS_REPLACED',          label: 'Spare Parts Replaced' },
  { key: 'QUALITY_CHECK_STARTED',   label: 'Quality Check Started' },
  { key: 'QUALITY_CHECK_COMPLETED', label: 'Quality Check Completed' },
  { key: 'REPAIR_COMPLETED',        label: 'Repair Completed' },
  { key: 'REPAIR_NOT_COMPLETED',    label: 'Repair Not Completed' },
];

// Rows that always emit a fixed note when the technician marks them.
// Saves them typing a free-text reason every time and keeps the wording the
// customer + shop see consistent across tickets.
const DEFAULT_PROGRESS_NOTE = {
  REPAIR_NOT_COMPLETED: 'Your repair is not completed',
};

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

// Section header: a small vertical accent bar + bold title + optional right
// action. Used throughout the screen so every section reads with the same
// visual rhythm (Swiggy / Zomato-style card sections).
function SectionHeader({ title, accent = '#22C55E', right = null }) {
  return (
    <View className="flex-row items-center mb-2 mt-1">
      <View
        style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: accent, marginRight: 8 }}
      />
      <Text className="text-[14px] font-extrabold text-text flex-1">{title}</Text>
      {right}
    </View>
  );
}

// Card shell with the elevation / border combo used on every section. Keeps
// the visual rhythm consistent and avoids re-typing the same className blob.
function Card({ children, style }) {
  return (
    <View
      className="bg-white rounded-2xl px-3 py-3 mb-4"
      style={[
        { borderWidth: 1, borderColor: '#EEF2F7', shadowColor: '#0F172A',
          shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
          elevation: 1 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// Empty image-upload slot. Big dashed circle with a prominent + icon and
// "Add Photo" label below — replaces the previous tiny camera tile so the
// tap target reads as an obvious "add" affordance.
function AddPhotoSlot({ onPress, height = 110 }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl items-center justify-center"
      style={{
        borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CBD5E1',
        backgroundColor: '#F8FAFC', height,
      }}
    >
      <View
        style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: '#22C55E',
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#22C55E', shadowOpacity: 0.25, shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 }, elevation: 3,
        }}
      >
        <Plus size={20} color="#FFFFFF" />
      </View>
      <Text className="text-[10px] font-bold text-text-muted mt-2">Add Photo</Text>
    </Pressable>
  );
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

  // Compliance note attachments. Image slots mirror the Your-Side photos grid
  // above (3 slots). Audio mirrors the owner-side ServicePriceEstimateScreen
  // recorder: clip uploads to Cloudinary as soon as the user taps Stop, so by
  // the time they hit Save Note the hosted URL is already ready.
  const [noteImages, setNoteImages] = useState([null, null, null]);
  const [noteAudioUrl, setNoteAudioUrl] = useState('');          // hosted URL (after upload)
  const [noteAudioLocalUri, setNoteAudioLocalUri] = useState(''); // local file, pre-upload
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [playingId, setPlayingId] = useState(null); // key of the currently playing audio
  const recordingRef = useRef(null);
  const soundRef = useRef(null);
  const tickRef = useRef(null);

  // 1 Hz-ish timer while recording so the technician sees the duration tick up.
  useEffect(() => {
    if (isRecording) {
      const start = Date.now();
      tickRef.current = setInterval(() => {
        setRecordingMs(Date.now() - start);
      }, 250);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      setRecordingMs(0);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isRecording]);

  // Free the recorder / player when we leave the screen so the next mount can
  // re-acquire the mic without "Already prepared" errors.
  useEffect(() => () => {
    try { recordingRef.current?.stopAndUnloadAsync?.(); } catch (_) {}
    try { soundRef.current?.unloadAsync?.(); } catch (_) {}
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

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
  // Per-row note input — only the PARTS_REQUIRED row prompts for one today
  // ("which part is on order, ETA?") and it's passed through to the backend so
  // the customer / shop / technician timelines all read the same explanation.
  const [progressNotes, setProgressNotes] = useState({});

  const refreshProgress = useCallback(async () => {
    if (!ticketId) return;
    try {
      const rows = await listTicketEvents(ticketId);
      const done = {};
      // Latest non-default note per row, keyed by status. We need this so
      // a re-opened ticket pre-fills the PARTS_REQUIRED input with what the
      // technician submitted last time (e.g. "Display + battery on order").
      const noteByKey = {};
      // Only pre-tick rows the TECHNICIAN explicitly submitted. Auto-emitted
      // macro-status events (actor=SHOP / SYSTEM) leave the checkbox empty
      // so the technician still has to take the action manually.
      (Array.isArray(rows) ? rows : []).forEach((e) => {
        const k = (e.status || '').toUpperCase();
        const actor = (e.actor || '').toUpperCase();
        const isProgressRow = PROGRESS_ROWS.some((r) => r.key === k);
        if (!isProgressRow) return;
        if (actor === 'TECHNICIAN') done[k] = true;
        // Default label means the technician didn't type a custom note —
        // skip those so the input doesn't fill itself with "Spare Parts
        // Waiting" the next visit.
        const row = PROGRESS_ROWS.find((r) => r.key === k);
        if (e?.note && row && e.note !== row.label) noteByKey[k] = e.note;
      });
      setProgressDone(done);
      setProgressNotes((prev) => ({ ...noteByKey, ...prev }));
    } catch { /* keep current */ }
  }, [ticketId]);

  useEffect(() => { refreshProgress(); }, [refreshProgress]);

  const submitProgress = useCallback(async (row) => {
    if (!progressChecked[row.key] && !progressDone[row.key]) {
      notify('Tick the box first', `Check "${row.label}" before submitting.`);
      return;
    }
    // PARTS_REQUIRED row requires the technician to spell out which part is
    // waiting; without it the customer / shop see no detail beyond the label.
    const rawNote = (progressNotes[row.key] || '').trim();
    if (row.key === 'PARTS_REQUIRED' && !rawNote) {
      notify('Add a note', 'Mention which spare part is on order so the customer and shop know what we\'re waiting for.');
      return;
    }
    // Rows in DEFAULT_PROGRESS_NOTE auto-attach the canonical sentence the
    // customer should read (e.g. "Your repair is not completed"); the
    // technician doesn't need to type anything.
    const noteToSend = rawNote || DEFAULT_PROGRESS_NOTE[row.key] || undefined;
    setProgressBusy(row.key);
    try {
      await postProgressEvent(ticketId, {
        statusKey: row.key,
        note: noteToSend,
      });
      setProgressChecked((prev) => ({ ...prev, [row.key]: false }));
      refreshProgress();
      notify('Saved', `"${row.label}" recorded.`);
    } catch (e) {
      notify('Save failed', e?.message || 'Try again');
    } finally {
      setProgressBusy(null);
    }
  }, [ticketId, progressChecked, progressDone, progressNotes, refreshProgress]);


  const devicePhotos = useMemo(
    () => parseDevicePhotos(ticket?.devicePhotosJson),
    [ticket?.devicePhotosJson],
  );

  // missingPartsJson is either a JSON array of strings (legacy) or of
  // {partId, name|partName|label, missing, damage} objects. Flatten to a
  // labels list so the card can render them as comma-separated chips.
  const missingPartsLabels = useMemo(() => {
    const arr = parseJsonArray(ticket?.missingPartsJson);
    return arr
      .map((it) => (it && typeof it === 'object'
        ? (it.label || it.name || it.partName)
        : String(it)))
      .filter(Boolean);
  }, [ticket?.missingPartsJson]);


  // ---------- Your-Side photo picker + submit ----------

  const pickPhoto = async (index, fromCamera = false) => {
    if (Platform.OS !== 'web') {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify(
          'Permission required',
          `Allow ${fromCamera ? 'camera' : 'photo library'} access to upload device images.`,
        );
        return;
      }
    }
    const opts = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setYourPhotos((prev) => {
      const next = [...prev];
      next[index] = { uri: asset.uri, remoteUrl: null, name: asset.fileName, type: asset.mimeType };
      return next;
    });
  };

  const promptPickPhoto = (index) => {
    if (Platform.OS === 'web') {
      pickPhoto(index, false);
      return;
    }
    Alert.alert('Add device image', '', [
      { text: 'Take Photo', onPress: () => pickPhoto(index, true) },
      { text: 'Choose from Gallery', onPress: () => pickPhoto(index, false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

  // Compliance image picker — same camera/gallery chooser pattern as the
  // Your-Side device images above, but writes into the noteImages slot list.
  const pickNoteImage = async (index, fromCamera) => {
    if (Platform.OS !== 'web') {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify(
          'Permission required',
          `Allow ${fromCamera ? 'camera' : 'photo library'} access to attach images.`,
        );
        return;
      }
    }
    const opts = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setNoteImages((prev) => {
      const next = [...prev];
      next[index] = { uri: asset.uri, name: asset.fileName, type: asset.mimeType };
      return next;
    });
  };

  const promptPickNoteImage = (index) => {
    if (Platform.OS === 'web') { pickNoteImage(index, false); return; }
    Alert.alert('Add image', '', [
      { text: 'Take Photo', onPress: () => pickNoteImage(index, true) },
      { text: 'Choose from Gallery', onPress: () => pickNoteImage(index, false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removeNoteImage = (index) => {
    setNoteImages((prev) => { const next = [...prev]; next[index] = null; return next; });
  };

  const startNoteRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        notify('Microphone needed', 'Allow microphone access to record a voice note.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      setIsRecording(true);
    } catch (e) {
      notify('Could not start recording', e?.message || 'Please try again.');
    }
  };

  const stopNoteRecording = async () => {
    try {
      setIsRecording(false);
      const rec = recordingRef.current;
      if (!rec) return;
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      if (!uri) return;
      setNoteAudioLocalUri(uri);
      // Upload immediately so by the time the user hits Save Note we already
      // have the hosted URL ready to attach. Matches owner-side flow.
      setUploadingAudio(true);
      try {
        const ext = (uri.split('.').pop() || 'm4a').toLowerCase();
        const res = await uploadMedia({
          uri,
          name: `note-${Date.now()}.${ext}`,
          type: `audio/${ext === 'mp3' ? 'mpeg' : ext}`,
          folder: `tickets/${ticketId}/notes`,
        });
        const url = res?.url || res?.secure_url || null;
        if (!url) throw new Error('Upload returned no URL');
        setNoteAudioUrl(url);
      } catch (err) {
        notify('Upload failed', err?.message || 'Could not upload recording.');
      } finally {
        setUploadingAudio(false);
      }
    } catch (e) {
      notify('Could not stop recording', e?.message || 'Please try again.');
    }
  };

  const clearNoteAudio = async () => {
    try {
      if (playingId === 'draft' && soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch (_) {}
        soundRef.current = null;
        setPlayingId(null);
      }
    } catch (_) {}
    setNoteAudioLocalUri('');
    setNoteAudioUrl('');
  };

  // Playback for the draft recording OR any submitted note's audioUrl. The
  // single soundRef means only one clip plays at a time — pressing play on a
  // second clip stops the first.
  const togglePlayAudio = async (key, uri) => {
    try {
      if (playingId === key && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlayingId(null);
        return;
      }
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch (_) {}
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status?.didJustFinish) setPlayingId(null);
      });
      await sound.playAsync();
      setPlayingId(key);
    } catch (e) {
      notify('Playback failed', e?.message || 'Could not play this clip.');
    }
  };

  const submitNote = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setNoteSubmitting(true);
    try {
      // Audio was uploaded synchronously when recording stopped; just use the
      // hosted URL. Images still upload here so the user can keep adding tiles
      // until submit.
      const audioUrl = noteAudioUrl || null;

      // Upload each populated image slot in order. Keeps slot order in the
      // saved list so the rendering on the notes list matches what the
      // technician saw at submit time.
      const imageUrls = [];
      for (const slot of noteImages) {
        if (!slot?.uri) continue;
        const res = await uploadMedia({
          uri: slot.uri,
          name: slot.name || `note-image-${Date.now()}.jpg`,
          type: slot.type || 'image/jpeg',
          folder: `tickets/${ticketId}/notes`,
        });
        const url = res?.url || res?.secure_url || null;
        if (!url) throw new Error('Image upload returned no URL');
        imageUrls.push(url);
      }

      await addRepairNote(ticketId, { note: trimmed, audioUrl, imageUrls });
      setNote('');
      setNoteAudioUrl('');
      setNoteAudioLocalUri('');
      setNoteImages([null, null, null]);
      // Backend emits TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED on note
      // submit; re-pull the notes list so the freshly-saved note shows under
      // Submit. The timeline rail on the owner/customer side updates on its
      // own refresh from the backend event we just emitted.
      refreshNotes();
      notify('Note added', 'Your compliance note has been saved.');
    } catch (e) {
      // Surface the backend's actual message so a stale ticket-service or a
      // server-side validation error stops being hidden behind a generic
      // "Try again" string. e.status comes from ticketApi.client when the
      // response was an HTTP error; we include it so the user can tell a
      // network failure (status undefined) from a backend 5xx.
      const detail = e?.status ? `${e.message || 'Failed'} (HTTP ${e.status})` : e?.message;
      notify('Could not save note', detail || 'No response from server. Check that ticket-service is running.');
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

  const noteReady = !!note.trim();
  const noteSubmitBlocked = noteSubmitting || !noteReady || isRecording || uploadingAudio;
  const noteAttachmentCount =
    ((noteAudioUrl || noteAudioLocalUri) ? 1 : 0)
    + noteImages.filter((s) => !!s?.uri).length;
  const recSeconds = Math.floor(recordingMs / 1000);
  const recLabel = `${String(Math.floor(recSeconds / 60)).padStart(2, '0')}:${String(recSeconds % 60).padStart(2, '0')}`;

  return (
    <View className="flex-1" style={{ backgroundColor: '#F5F7FB' }}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Device hero card — Swiggy-style: white card, large thumbnail, bold
            device name, red pill for the compliance issue. */}
        <Card>
          <View className="flex-row items-center">
            {ticket.deviceImageUrl ? (
              <Image
                source={{ uri: ticket.deviceImageUrl }}
                style={{ width: 64, height: 84, borderRadius: 12, backgroundColor: '#F1F5F9' }}
              />
            ) : (
              <View
                style={{ width: 64, height: 84, borderRadius: 12, backgroundColor: '#F1F5F9' }}
                className="items-center justify-center"
              >
                <Smartphone size={26} color="#94A3B8" />
              </View>
            )}
            <View className="flex-1 ml-3">
              <Text className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Device</Text>
              <Text className="text-[15px] font-extrabold text-text mt-0.5" numberOfLines={2}>
                {ticket.deviceDisplayName || '—'}
              </Text>
              {ticket.repairServicesSummary ? (
                <View
                  className="self-start rounded-full px-2 py-0.5 mt-2"
                  style={{ backgroundColor: '#FEE2E2' }}
                >
                  <Text className="text-[10px] font-extrabold" style={{ color: '#B91C1C' }} numberOfLines={1}>
                    {ticket.repairServicesSummary}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Customer-side device images. Read-only strip; if empty, show a
            friendly placeholder instead of a dashed empty box. */}
        <SectionHeader title="Customer Device Images" accent="#3B82F6" />
        <Card>
          {devicePhotos.length === 0 ? (
            <View className="items-center py-3">
              <ImageIcon size={22} color="#CBD5E1" />
              <Text className="text-text-muted text-[11px] mt-1">No images uploaded by the customer yet.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row">
                {devicePhotos.map((url, i) => (
                  <Image
                    key={i}
                    source={{ uri: url }}
                    style={{ width: 88, height: 100, borderRadius: 12, marginRight: 8, backgroundColor: '#F1F5F9' }}
                  />
                ))}
              </View>
            </ScrollView>
          )}
        </Card>

        {/* Device Security + Missing/Damage Parts — paired card. Security
            value is masked behind a tap-to-reveal so the PIN/pattern only
            appears when the technician explicitly asks for it. */}
        <SectionHeader title="Device Security & Missing / Damage Parts" accent="#DC2626" />
        <Card>
          {/* Security row */}
          <View className="flex-row items-center">
            <View
              className="rounded-full items-center justify-center"
              style={{ width: 32, height: 32, backgroundColor: '#DCFCE7' }}
            >
              <ShieldCheck size={16} color="#15803D" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Device Security
              </Text>
              {ticket.deviceSecurityType && ticket.deviceSecurityType !== 'NONE' ? (
                <View className="flex-row items-center mt-0.5">
                  <Text className="text-[13px] font-extrabold text-text">
                    {ticket.deviceSecurityType}
                  </Text>
                  <Text className="text-[13px] font-extrabold text-text mx-1">·</Text>
                  <Text
                    className="text-[13px] font-extrabold text-text"
                    style={{ letterSpacing: 1 }}
                  >
                    {ticket.deviceSecurityValue || '—'}
                  </Text>
                </View>
              ) : (
                <Text className="text-[13px] font-bold text-text-muted mt-0.5">No lock set</Text>
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }} />

          {/* Missing / Damage parts row */}
          <View className="flex-row">
            <View
              className="rounded-full items-center justify-center"
              style={{ width: 32, height: 32, backgroundColor: '#FEE2E2' }}
            >
              <PackageX size={16} color="#B91C1C" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Missing / Damage Parts
              </Text>
              {missingPartsLabels.length > 0 ? (
                <View className="flex-row flex-wrap mt-1.5 -mx-0.5">
                  {missingPartsLabels.map((label, i) => (
                    <View
                      key={`${label}-${i}`}
                      className="rounded-full px-2.5 py-1 mx-0.5 mb-1"
                      style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}
                    >
                      <Text className="text-[11px] font-extrabold" style={{ color: '#B91C1C' }}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-[13px] font-bold text-text-muted mt-0.5">Nil</Text>
              )}
            </View>
          </View>
        </Card>

        {/* Your-Side upload card. Three big "+" slots; once filled, the
            technician must tap Submit to persist the URLs to the ticket. */}
        <SectionHeader
          title="Your Side Device Images"
          accent="#22C55E"
          right={
            !photosEditing && yourPhotos.some((s) => s?.remoteUrl) ? (
              <TouchableOpacity
                onPress={() => setPhotosEditing(true)}
                className="flex-row items-center rounded-full px-3 py-1.5"
                style={{ backgroundColor: '#EDE9FE' }}
              >
                <Pencil size={12} color="#7C3AED" />
                <Text className="text-[11px] font-extrabold ml-1" style={{ color: '#7C3AED' }}>Edit</Text>
              </TouchableOpacity>
            ) : null
          }
        />
        <Card>
          <View className="flex-row -mx-1">
            {yourPhotos.map((slot, i) => (
              <View key={i} className="flex-1 px-1">
                {slot ? (
                  <View
                    className="rounded-2xl overflow-hidden"
                    style={{ height: 110, backgroundColor: '#F1F5F9' }}
                  >
                    <Image source={{ uri: slot.uri }} style={{ width: '100%', height: '100%' }} />
                    {photosEditing ? (
                      <TouchableOpacity
                        onPress={() => removePhoto(i)}
                        hitSlop={8}
                        style={{
                          position: 'absolute', top: 6, right: 6,
                          backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: 14, padding: 4,
                        }}
                      >
                        <X size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  <AddPhotoSlot
                    onPress={() => (photosEditing ? promptPickPhoto(i) : setPhotosEditing(true))}
                  />
                )}
              </View>
            ))}
          </View>
          {photosEditing ? (
            <TouchableOpacity
              onPress={submitPhotos}
              disabled={photosSubmitting}
              className="rounded-2xl items-center justify-center mt-3"
              style={{
                backgroundColor: '#22C55E',
                paddingVertical: 12,
                opacity: photosSubmitting ? 0.6 : 1,
                shadowColor: '#22C55E', shadowOpacity: 0.25, shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 }, elevation: 3,
              }}
            >
              {photosSubmitting
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text className="text-white font-extrabold text-[13px]">Save Device Images</Text>}
            </TouchableOpacity>
          ) : null}
        </Card>

        {/* Compliance Notes — single card with the textarea, voice-note row,
            three image slots, and a full-width "Save Note" CTA at the bottom.
            Mirrors the Swiggy "Add Instructions" pattern. */}
        <SectionHeader title="Technician Issue Verified & Updated" accent="#F59E0B" />
        <Card>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Describe the issue you verified — what was found, what's been updated, anything the customer should know."
            placeholderTextColor="#94A3B8"
            className="text-[13px] text-text"
            style={{
              backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
              borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
              minHeight: 90, textAlignVertical: 'top',
            }}
          />

          {/* Voice note recorder — three visual states mirror owner-side
              ServicePriceEstimateScreen so technicians get the same affordance:
                (a) idle, no clip → big green "Record voice note" pill
                (b) recording     → red pulse + mm:ss timer + Stop button
                (c) clip ready    → play/pause + status + remove */}
          <Text className="text-[10px] font-extrabold text-text-muted tracking-widest mt-4 mb-2">
            VOICE NOTE
          </Text>
          {isRecording ? (
            <View
              className="flex-row items-center rounded-2xl px-3 py-2.5"
              style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}
            >
              <View className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: '#EF4444' }} />
              <View className="flex-1">
                <Text className="text-[12px] font-extrabold" style={{ color: '#DC2626' }}>Recording…</Text>
                <Text className="text-[11px] font-bold" style={{ color: '#DC2626' }}>{recLabel}</Text>
              </View>
              <TouchableOpacity
                onPress={stopNoteRecording}
                className="flex-row items-center rounded-full px-3 py-2"
                style={{ backgroundColor: '#EF4444' }}
              >
                <Square size={12} color="#FFFFFF" fill="#FFFFFF" />
                <Text className="text-white text-[12px] font-extrabold ml-1.5">Stop</Text>
              </TouchableOpacity>
            </View>
          ) : (noteAudioUrl || noteAudioLocalUri) ? (
            <View
              className="flex-row items-center rounded-2xl px-3 py-2.5"
              style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }}
            >
              <TouchableOpacity
                onPress={() => togglePlayAudio('draft', noteAudioUrl || noteAudioLocalUri)}
                disabled={uploadingAudio}
                className="h-10 w-10 rounded-full items-center justify-center"
                style={{ backgroundColor: '#22C55E', opacity: uploadingAudio ? 0.6 : 1 }}
              >
                {playingId === 'draft'
                  ? <Pause size={16} color="#FFFFFF" />
                  : <Play size={16} color="#FFFFFF" />}
              </TouchableOpacity>
              <View className="flex-1 ml-2.5">
                <Text className="text-[12.5px] font-extrabold text-text">Voice note attached</Text>
                <Text className="text-[10.5px] text-text-muted">
                  {uploadingAudio
                    ? 'Uploading to cloud…'
                    : (noteAudioUrl ? 'Uploaded · tap play to preview' : 'Tap play to preview')}
                </Text>
              </View>
              {uploadingAudio ? (
                <ActivityIndicator color="#22C55E" />
              ) : (
                <TouchableOpacity
                  onPress={clearNoteAudio}
                  className="h-9 w-9 rounded-full items-center justify-center"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
                  hitSlop={6}
                >
                  <Trash2 size={14} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              onPress={startNoteRecording}
              className="flex-row items-center justify-center rounded-2xl py-3"
              style={{
                backgroundColor: '#22C55E',
                shadowColor: '#22C55E', shadowOpacity: 0.25, shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 }, elevation: 3,
              }}
            >
              <Mic size={16} color="#FFFFFF" />
              <Text className="text-white text-[13px] font-extrabold ml-2">Record voice note</Text>
            </TouchableOpacity>
          )}

          {/* Image attachments — small label row, then the three preview
              tiles directly below. Each empty tile is tappable so the
              technician can pick a specific slot to fill. */}
          {(() => {
            const filled = noteImages.filter((s) => !!s?.uri).length;
            return (
              <>
                <View className="flex-row items-center justify-between mt-4 mb-2">
                  <Text className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider">
                    Attach Photos
                  </Text>
                  <Text className="text-[10px] font-bold text-text-muted">
                    {filled}/3
                  </Text>
                </View>
                <View className="flex-row -mx-1">
                  {noteImages.map((slot, i) => (
                    <View key={i} className="flex-1 px-1">
                      {slot ? (
                        <View
                          className="rounded-2xl overflow-hidden"
                          style={{ height: 96, backgroundColor: '#F1F5F9' }}
                        >
                          <Image source={{ uri: slot.uri }} style={{ width: '100%', height: '100%' }} />
                          <TouchableOpacity
                            onPress={() => removeNoteImage(i)}
                            hitSlop={8}
                            style={{
                              position: 'absolute', top: 6, right: 6,
                              backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: 12, padding: 4,
                            }}
                          >
                            <X size={12} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <AddPhotoSlot onPress={() => promptPickNoteImage(i)} height={96} />
                      )}
                    </View>
                  ))}
                </View>
              </>
            );
          })()}

          {/* Full-width primary CTA */}
          <TouchableOpacity
            onPress={submitNote}
            disabled={noteSubmitBlocked}
            className="rounded-2xl items-center justify-center mt-4"
            style={{
              backgroundColor: '#22C55E',
              paddingVertical: 14,
              opacity: noteSubmitBlocked ? 0.5 : 1,
              shadowColor: '#22C55E', shadowOpacity: 0.3, shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 }, elevation: 4,
            }}
          >
            {noteSubmitting
              ? <ActivityIndicator color="#FFFFFF" />
              : (
                <Text className="text-white font-extrabold text-[14px]">
                  Save Note{noteAttachmentCount ? ` (+${noteAttachmentCount} ${noteAttachmentCount === 1 ? 'attachment' : 'attachments'})` : ''}
                </Text>
              )}
          </TouchableOpacity>
          {noteSubmitBlocked && !noteSubmitting ? (
            <Text className="text-[10px] text-text-muted text-center mt-2">
              {uploadingAudio
                ? 'Uploading voice note…'
                : isRecording
                ? 'Stop the recording first.'
                : !noteReady
                ? 'Enter a note to submit. Voice + photos are optional.'
                : null}
            </Text>
          ) : null}
        </Card>

        {/* Previously-submitted notes — each rendered as a left-accented
            card so the technician can re-read what they've recorded. */}
        {notesList.length > 0 ? (
          <>
            <SectionHeader title="Submitted Notes" accent="#0F172A" />
            <View className="mb-4">
              {notesList.slice(0, 5).map((n) => {
                const imgs = Array.isArray(n.imageUrls) ? n.imageUrls : [];
                const audioKey = `note-${n.id}`;
                return (
                  <View
                    key={n.id}
                    className="bg-white rounded-2xl p-3 mb-2 flex-row"
                    style={{ borderWidth: 1, borderColor: '#EEF2F7' }}
                  >
                    <View
                      style={{ width: 3, borderRadius: 2, backgroundColor: '#22C55E', marginRight: 10 }}
                    />
                    <View className="flex-1">
                      <Text className="text-[13px] text-text">{n.note}</Text>
                      {n.audioUrl ? (
                        <View className="flex-row items-center mt-2">
                          <TouchableOpacity
                            onPress={() => togglePlayAudio(audioKey, n.audioUrl)}
                            className="flex-row items-center rounded-full px-2.5 py-1"
                            style={{ borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }}
                          >
                            {playingId === audioKey
                              ? <Pause size={12} color="#0F172A" />
                              : <Play size={12} color="#0F172A" />}
                            <Text className="text-[11px] font-bold text-text ml-1">Voice note</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                      {imgs.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                          <View className="flex-row">
                            {imgs.map((u, j) => (
                              <Image
                                key={j}
                                source={{ uri: u }}
                                style={{ width: 60, height: 60, borderRadius: 8, marginRight: 6 }}
                              />
                            ))}
                          </View>
                        </ScrollView>
                      ) : null}
                      <Text className="text-[10px] text-text-muted mt-1.5">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Service Progress checklist — matches the Service History timeline
            row-for-row. Each row has three visual states:
              * idle    → numbered chip + label + faint chevron-style tick
              * pending → tick goes green; [Done] (confirms emit) + [Cancel]
                          (clears the tick) appear as a chip pair, Swiggy
                          "Place Order / Cancel"-style
              * done    → green DONE pill + small "Re-submit" link */}
        <SectionHeader title="Service Progress" accent="#22C55E" />
        <Card>
          <Text className="text-[10.5px] text-text-muted mb-2">
            Tick a row and tap Done to record that step on the customer's Service History.
          </Text>
          {PROGRESS_ROWS.map((row, idx) => {
            const checked = !!progressChecked[row.key];
            const done = !!progressDone[row.key];
            const busy = progressBusy === row.key;
            const stepNo = String(idx + 1).padStart(2, '0');
            const toggleTick = () =>
              setProgressChecked((prev) => ({ ...prev, [row.key]: !prev[row.key] }));
            const needsNote = row.key === 'PARTS_REQUIRED';
            const noteValue = progressNotes[row.key] || '';
            const showNoteInput = needsNote && (checked || done);
            return (
              <View
                key={row.key}
                style={{
                  paddingVertical: 12,
                  borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#F1F5F9',
                }}
              >
                <View className="flex-row items-center">
                {/* Numbered chip — green tint when done, gray otherwise. */}
                <View
                  className="rounded-full items-center justify-center"
                  style={{
                    width: 30, height: 30,
                    backgroundColor: done ? '#DCFCE7' : checked ? '#FEF3C7' : '#F1F5F9',
                  }}
                >
                  {done
                    ? <Check size={14} color="#15803D" />
                    : (
                      <Text
                        className="text-[10px] font-extrabold"
                        style={{ color: checked ? '#B45309' : '#64748B' }}
                      >
                        {stepNo}
                      </Text>
                    )}
                </View>

                <Pressable
                  onPress={done ? null : toggleTick}
                  className="flex-1 ml-3"
                  style={({ pressed }) => ({ opacity: pressed && !done ? 0.7 : 1 })}
                >
                  <Text
                    className={`text-[13px] ${done ? 'font-extrabold' : 'font-bold'} text-text`}
                    numberOfLines={1}
                  >
                    {row.label}
                  </Text>
                  {checked && !done ? (
                    <Text className="text-[10px] text-text-muted mt-0.5">
                      Tap Done to confirm.
                    </Text>
                  ) : done ? (
                    <Text className="text-[10px] mt-0.5" style={{ color: '#15803D' }}>
                      Recorded
                    </Text>
                  ) : null}
                </Pressable>

                {/* Right action area: changes by state. */}
                {done ? (
                  <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#DCFCE7' }}>
                    <Text className="text-[10px] font-extrabold" style={{ color: '#15803D' }}>DONE</Text>
                  </View>
                ) : checked ? (
                  <View className="flex-row items-center">
                    {/* Done — primary confirmation, fires the emit. */}
                    <TouchableOpacity
                      onPress={() => submitProgress(row)}
                      disabled={busy}
                      className="rounded-full flex-row items-center"
                      style={{
                        backgroundColor: '#22C55E',
                        paddingHorizontal: 14, paddingVertical: 7,
                        opacity: busy ? 0.6 : 1,
                        shadowColor: '#22C55E', shadowOpacity: 0.3, shadowRadius: 4,
                        shadowOffset: { width: 0, height: 2 }, elevation: 2,
                      }}
                    >
                      {busy
                        ? <ActivityIndicator color="#FFFFFF" size="small" />
                        : (
                          <>
                            <Check size={12} color="#FFFFFF" />
                            <Text className="text-[11px] font-extrabold text-white ml-1">Done</Text>
                          </>
                        )}
                    </TouchableOpacity>
                    {/* Cancel — clears the tick, no emit. */}
                    <TouchableOpacity
                      onPress={toggleTick}
                      disabled={busy}
                      className="rounded-full flex-row items-center ml-2"
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1, borderColor: '#CBD5E1',
                        paddingHorizontal: 12, paddingVertical: 6,
                      }}
                    >
                      <X size={11} color="#64748B" />
                      <Text className="text-[11px] font-extrabold ml-1" style={{ color: '#64748B' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Idle: a Mark chip that ticks the row (same as tapping the label).
                  <TouchableOpacity
                    onPress={toggleTick}
                    className="rounded-full"
                    style={{
                      backgroundColor: '#F1F5F9',
                      paddingHorizontal: 14, paddingVertical: 7,
                    }}
                  >
                    <Text className="text-[11px] font-extrabold" style={{ color: '#475569' }}>Mark</Text>
                  </TouchableOpacity>
                )}
                </View>

                {/* Note input — only on the Spare Parts Waiting row. Backend
                    persists the text as repair_booking_events.note, which is
                    what the customer + shop + technician timelines render
                    below the matching step row. */}
                {showNoteInput ? (
                  <View className="ml-[42px] mt-2">
                    <Text className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1">
                      Which spare part is waiting?
                    </Text>
                    <TextInput
                      value={noteValue}
                      onChangeText={(v) =>
                        setProgressNotes((prev) => ({ ...prev, [row.key]: v }))
                      }
                      multiline
                      placeholder="e.g. Display + battery on order from Samsung distributor, ETA 3 days."
                      placeholderTextColor="#94A3B8"
                      editable={!busy}
                      className="text-[12px] text-text"
                      style={{
                        backgroundColor: '#FFFBEB',
                        borderWidth: 1, borderColor: '#FDE68A',
                        borderRadius: 10,
                        paddingHorizontal: 10, paddingVertical: 8,
                        minHeight: 60, textAlignVertical: 'top',
                      }}
                    />
                    <Text className="text-[9.5px] text-text-muted mt-1">
                      Shown to the customer, shop owner, and on your own history rail.
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>

        {/* Solution Pack — two big CTAs, one for viewing existing references
            and one for uploading a new solution. Icon-in-circle + label. */}
        <SectionHeader title="Solution Packs" accent="#3B82F6" />
        <View className="flex-row -mx-1 mb-2">
          <View className="flex-1 px-1">
            <TouchableOpacity
              onPress={openReferenceView}
              className="rounded-2xl"
              style={{
                backgroundColor: '#3B82F6', paddingVertical: 16, paddingHorizontal: 12,
                shadowColor: '#3B82F6', shadowOpacity: 0.25, shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 }, elevation: 3,
              }}
            >
              <View
                className="w-9 h-9 rounded-full items-center justify-center mb-2"
                style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
              >
                <Search size={16} color="#FFFFFF" />
              </View>
              <Text className="text-white font-extrabold text-[13px]">View Reference</Text>
              <Text className="text-white text-[10px] opacity-80 mt-0.5">Find an existing solution pack</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-1 px-1">
            <TouchableOpacity
              onPress={openUploadScreen}
              className="rounded-2xl"
              style={{
                backgroundColor: '#7C3AED', paddingVertical: 16, paddingHorizontal: 12,
                shadowColor: '#7C3AED', shadowOpacity: 0.25, shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 }, elevation: 3,
              }}
            >
              <View
                className="w-9 h-9 rounded-full items-center justify-center mb-2"
                style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
              >
                <UploadCloud size={16} color="#FFFFFF" />
              </View>
              <Text className="text-white font-extrabold text-[13px]">Upload New</Text>
              <Text className="text-white text-[10px] opacity-80 mt-0.5">Share your fix with the team</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
