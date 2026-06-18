import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { applyEmployeeLeave } from '../api/technician';
import { uploadMedia } from '../api/media';
import { notify } from '../components/confirm';

// Whitelist mirrors ALLOWED_LEAVE_TYPES on the backend. Order is the order
// shown in the chip row. HALF_DAY auto-locks the date range to a single
// day and stamps totalDays=0.5 server-side.
const LEAVE_TYPES = [
  { value: 'CASUAL_LEAVE',    label: 'Casual' },
  { value: 'SICK_LEAVE',      label: 'Sick' },
  { value: 'EMERGENCY_LEAVE', label: 'Emergency' },
  { value: 'PERMISSION',      label: 'Permission' },
  { value: 'HALF_DAY',        label: 'Half Day' },
  { value: 'OTHER',           label: 'Other' },
];

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISO(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Inclusive day count, e.g. 2026-06-10 → 2026-06-12 = 3 days.
function daysBetween(startISO, endISO) {
  const a = parseISO(startISO);
  const b = parseISO(endISO);
  if (!a || !b || b < a) return 0;
  return Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1;
}

export default function TechnicianApplyLeaveScreen({ navigation }) {
  const today = toISO(new Date());
  const [leaveType, setLeaveType] = useState('CASUAL_LEAVE');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState(null); // { uri, url, name }
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalDays = useMemo(() => {
    if (leaveType === 'HALF_DAY') return 0.5;
    return daysBetween(startDate, endDate);
  }, [leaveType, startDate, endDate]);

  const pickLeaveType = (next) => {
    setLeaveType(next);
    if (next === 'HALF_DAY') {
      // Half-day always spans a single day. Snap the end back to start so
      // totalDays stays consistent regardless of any earlier selection.
      setEndDate(startDate);
    }
  };

  const pickAttachment = async () => {
    if (uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      notify('Permission required', 'Allow photo access to attach a proof image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const res = await uploadMedia({
        uri: asset.uri,
        name: asset.fileName || 'leave-proof.jpg',
        type: asset.mimeType || 'image/jpeg',
        folder: 'leave-proofs',
      });
      setAttachment({ uri: asset.uri, url: res?.url, name: asset.fileName || 'Proof.jpg' });
    } catch (e) {
      notify('Upload failed', e?.message ?? 'Could not upload attachment', { preset: 'error', haptic: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const validate = () => {
    if (!leaveType) return 'Please select a leave type';
    const s = parseISO(startDate);
    const e = parseISO(endDate);
    if (!s) return 'Start date is required (YYYY-MM-DD)';
    if (!e) return 'End date is required (YYYY-MM-DD)';
    if (e < s) return 'End date cannot be before start date';
    if (!reason.trim()) return 'Reason is required';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { notify('Check the form', err); return; }
    setSaving(true);
    try {
      await applyEmployeeLeave({
        leaveType,
        startDate,
        endDate,
        totalDays,
        reason: reason.trim(),
        attachmentUrl: attachment?.url || null,
      });
      notify('Leave request submitted', 'Your leave request has been sent to the owner for review.', { preset: 'done' });
      // Pop back to LeaveReport (or its parent) so the just-applied entry
      // appears in the list. LeaveReport reloads in its useEffect on focus.
      navigation.goBack();
    } catch (e) {
      notify('Could not submit', e?.message ?? 'Failed to submit leave request', { preset: 'error', haptic: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Apply for Leave</Text>

        {/* Leave-type chip row. Three-per-row wrap matches the design. */}
        <Text style={styles.label}>Leave type</Text>
        <View style={styles.chipsRow}>
          {LEAVE_TYPES.map((t) => {
            const active = leaveType === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                onPress={() => pickLeaveType(t.value)}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Duration</Text>
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <TextInput
              style={styles.dateInput}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />
          </View>
          <Text style={styles.dateSep}>to</Text>
          <View style={styles.dateField}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <TextInput
              style={styles.dateInput}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
              editable={leaveType !== 'HALF_DAY'}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />
          </View>
        </View>
        <Text style={styles.helper}>
          {totalDays > 0
            ? `${totalDays % 1 === 0 ? totalDays : totalDays.toFixed(1)} day${totalDays === 1 ? '' : 's'}`
            : 'Pick a valid date range'}
        </Text>

        <Text style={styles.label}>Reason</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={reason}
          onChangeText={setReason}
          placeholder="Write description here"
          placeholderTextColor="#9CA3AF"
          multiline
        />

        <Text style={styles.label}>Attachment (optional)</Text>
        <TouchableOpacity
          style={styles.attachmentBtn}
          onPress={pickAttachment}
          activeOpacity={0.85}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#3B4FD7" size="small" />
          ) : (
            <>
              <Ionicons name={attachment ? 'checkmark-circle' : 'cloud-upload-outline'} size={18} color={attachment ? '#22C55E' : '#3B4FD7'} />
              <Text style={styles.attachmentBtnText} numberOfLines={1}>
                {attachment ? attachment.name : 'Upload medical / supporting proof'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.cancelBtn]}
            onPress={() => navigation.goBack()}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, (saving || uploading) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving || uploading}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.submitBtnText}>Submit</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F1FB' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 },
  label: { fontSize: 13, color: '#374151', fontWeight: '700', marginTop: 14, marginBottom: 6 },
  helper: { fontSize: 11, color: '#6B7280', marginTop: 4 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#3B4FD7', borderColor: '#3B4FD7' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  dateInput: { flex: 1, fontSize: 13, color: '#111827', padding: 0 },
  dateSep: { fontSize: 12, color: '#6B7280' },

  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 13, color: '#111827' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  attachmentBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 12, justifyContent: 'center' },
  attachmentBtnText: { fontSize: 12, color: '#374151', fontWeight: '600', flexShrink: 1 },

  footerRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  cancelBtnText: { color: '#374151', fontSize: 14, fontWeight: '700' },
  submitBtn: { flex: 2, paddingVertical: 14, borderRadius: 999, alignItems: 'center', backgroundColor: '#3B4FD7' },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
