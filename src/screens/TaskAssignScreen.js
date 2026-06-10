import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ticketApi } from '../api/client';
import { listMyTickets } from '../api/tickets';
import { confirm, notify } from '../components/confirm';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Tickets are split into the two sections at the top:
//   Re-Assign   — newly assigned, awaiting the technician's accept/reject
//   Recent Assign — already accepted, work in progress or queued
//
// CREATED is the just-came-in bucket. Anything past that has been accepted
// or auto-advanced. Backend doesn't have a dedicated "accepted" flag yet,
// so we key off the lifecycle status (see TicketService statuses).
const NEEDS_ACCEPT = new Set(['CREATED']);
const ACCEPTED_STATUSES = new Set(['IN_DIAGNOSIS', 'QUOTED', 'APPROVED', 'IN_REPAIR', 'READY']);

function trackingId(t) {
  return t.trackingId || `CSPEN${String(t.id || '').replace(/[^0-9]/g, '').slice(0, 8) || '——'}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TaskAssignScreen({ navigation }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const page = await listMyTickets({ page: 0, size: 100 });
      const items = Array.isArray(page?.content) ? page.content : (Array.isArray(page) ? page : []);
      setList(items);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Scope to picked month/year using whichever timestamp the backend last touched.
  const monthScoped = useMemo(() => {
    return list.filter((t) => {
      const stamp = t.updatedAt || t.createdAt;
      if (!stamp) return true;
      const d = new Date(stamp);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [list, year, month]);

  const reassignList = useMemo(
    () => monthScoped.filter((t) => NEEDS_ACCEPT.has(t.status)),
    [monthScoped],
  );
  const recentList = useMemo(
    () => monthScoped.filter((t) => ACCEPTED_STATUSES.has(t.status)),
    [monthScoped],
  );

  const counts = useMemo(() => ({
    assign: monthScoped.length,
    reassign: reassignList.length,
    total: list.length,
  }), [monthScoped, reassignList, list]);

  const stepMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    else if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  };

  // Accept moves the ticket from CREATED into IN_DIAGNOSIS (work begins);
  // Not Accept rejects by cancelling. Both reload to refresh the buckets.
  // `confirm`/`notify` from components/confirm are cross-platform — Alert.alert
  // doesn't resolve its button callbacks on Expo Web, which silently broke
  // both buttons.
  const updateStatus = async (ticketId, status, confirmMessage) => {
    const proceed = await confirm({
      title: confirmMessage.title,
      message: confirmMessage.message,
      confirmText: confirmMessage.confirmText,
      destructive: confirmMessage.destructive,
    });
    if (!proceed) return;
    setActingOn(ticketId);
    try {
      // Backend expects status as a query param (TicketController#updateStatus uses @RequestParam).
      await ticketApi.patch(`/tickets/${ticketId}/status`, { query: { status } });
      await load(true);
    } catch (e) {
      notify('Error', e?.message || 'Could not update ticket');
    } finally {
      setActingOn(null);
    }
  };

  const handleAccept = (ticketId) => updateStatus(
    ticketId,
    'IN_DIAGNOSIS',
    { title: 'Accept ticket?', message: 'Mark this ticket as accepted and start diagnosis.', confirmText: 'Accept' },
  );

  const handleReject = (ticketId) => updateStatus(
    ticketId,
    'CANCELLED',
    { title: 'Decline ticket?', message: 'The ticket will be cancelled. Continue?', confirmText: 'Decline', destructive: true },
  );

  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <Text style={styles.pageEyebrow}>Employee Working Hrs</Text>

        {/* This Month + month pill */}
        <View style={styles.monthRow}>
          <Text style={styles.monthLabel}>This Month</Text>
          <View style={styles.monthPill}>
            <TouchableOpacity onPress={() => stepMonth(-1)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <Ionicons name="chevron-back" size={12} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.monthPillText}>{MONTHS[month - 1]} {year}</Text>
            <TouchableOpacity onPress={() => stepMonth(1)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <Ionicons name="chevron-forward" size={12} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.calBadge}>
              <Ionicons name="calendar" size={12} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Stat tiles */}
        <View style={styles.statRow}>
          <StatTile value={String(counts.assign).padStart(3, '0')} label="Assign" icon="people" bg="#22C55E" />
          <StatTile value={String(counts.reassign).padStart(2, '0')} label="Re-Assign" icon="people" bg="#16A34A" />
          <StatTile value={String(counts.total).padStart(2, '0')} label="Total" icon="bag-handle" bg="#7C3AED" />
        </View>

        {/* Re-Assign section */}
        <Text style={styles.sectionHeader}>Re-Assign</Text>
        {loading && list.length === 0 ? (
          <ActivityIndicator color="#3B4FD7" style={{ marginVertical: 16 }} />
        ) : reassignList.length === 0 ? (
          <Text style={styles.empty}>No tickets waiting for your acceptance.</Text>
        ) : (
          reassignList.map((t) => (
            <TaskCard
              key={t.id}
              ticket={t}
              busy={actingOn === t.id}
              variant="reassign"
              onAccept={() => handleAccept(t.id)}
              onReject={() => handleReject(t.id)}
              onView={() => navigation.navigate('TechnicianTicketDetail', { ticketId: t.id })}
            />
          ))
        )}

        {/* Recent Assign section */}
        <Text style={styles.sectionHeader}>Recent Assign</Text>
        {recentList.length === 0 ? (
          <Text style={styles.empty}>No active tickets this month.</Text>
        ) : (
          recentList.map((t) => (
            <TaskCard
              key={t.id}
              ticket={t}
              busy={actingOn === t.id}
              variant="recent"
              onView={() => navigation.navigate('TechnicianTicketDetail', { ticketId: t.id })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function StatTile({ value, label, icon, bg }) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statTilePill, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={12} color="#FFFFFF" />
        <Text style={styles.statTilePillText}>{label}</Text>
      </View>
      <Text style={styles.statTileValue}>{value}</Text>
    </View>
  );
}

function TaskCard({ ticket, busy, variant, onAccept, onReject, onView }) {
  const isReassign = variant === 'reassign';
  return (
    <View style={styles.taskCard}>
      <View style={styles.taskAccent} />
      <View style={styles.taskInner}>
        <View style={styles.taskTopRow}>
          <Text style={styles.taskDate}>{formatDate(ticket.createdAt)}</Text>
          <Text style={styles.taskRef}>#{trackingId(ticket)}</Text>
        </View>
        <View style={styles.taskDeviceRow}>
          <Text style={styles.taskDevice} numberOfLines={1}>{ticket.deviceDisplayName || 'Device'}</Text>
          <Text style={styles.taskServices} numberOfLines={1}>{ticket.repairServicesSummary || '—'}</Text>
        </View>
        <View style={styles.taskLabelRow}>
          <Text style={styles.taskLabelMuted}>Model & Number</Text>
          <Text style={styles.taskLabelMuted}>Repair Issue</Text>
        </View>

        <View style={styles.taskActions}>
          {isReassign ? (
            <>
              <ActionButton
                label="Accepted"
                bg="#22C55E"
                onPress={onAccept}
                busy={busy}
              />
              <ActionButton
                label="Not Accepted"
                bg="#EF4444"
                onPress={onReject}
                busy={busy}
              />
            </>
          ) : (
            <>
              <ActionButton label="Accepted" bg="#22C55E" disabled />
              <ActionButton label="View Details" bg="#3B4FD7" onPress={onView} />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function ActionButton({ label, bg, onPress, busy, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: bg }, (busy || disabled) && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={busy || disabled}
      activeOpacity={0.85}
    >
      {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.actionBtnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 14, paddingBottom: 32 },

  pageEyebrow: { fontSize: 11, color: '#9CA3AF', marginBottom: 6, fontWeight: '500' },

  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  monthLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
  },
  monthPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  calBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', marginLeft: 2 },

  statRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    paddingBottom: 10,
    alignItems: 'center',
  },
  statTilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  statTilePillText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  statTileValue: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 6 },

  sectionHeader: { fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 4, marginBottom: 8 },

  taskCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  taskAccent: { width: 3, backgroundColor: '#7C3AED' },
  taskInner: { flex: 1, padding: 12 },

  taskTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskDate: { fontSize: 12, fontWeight: '700', color: '#111827' },
  taskRef: { fontSize: 11, fontWeight: '700', color: '#6B7280' },

  taskDeviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  taskDevice: { fontSize: 13, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  taskServices: { fontSize: 12, fontWeight: '600', color: '#111827', textAlign: 'right' },

  taskLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  taskLabelMuted: { fontSize: 10, color: '#9CA3AF' },

  taskActions: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 12 },
  actionBtn: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 6, minWidth: 96, alignItems: 'center' },
  actionBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  empty: { fontSize: 12, color: '#6B7280', textAlign: 'center', paddingVertical: 14 },
});
