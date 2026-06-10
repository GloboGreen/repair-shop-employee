import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Store,
  MapPin,
  Calendar,
  Briefcase,
  Wallet,
  BarChart3,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
} from 'lucide-react-native';
import { useTechnicianId } from '../auth/useTechnicianId';
import { getMyExperiences } from '../api/technician';

const COLORS = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  primary: '#00008B',
  banner: '#0B3D1F',
  green: '#16A34A',
  red: '#DC2626',
};

function formatDate(d) {
  if (!d) return '—';
  // Backend returns ISO yyyy-MM-dd; render as DD-Mon-YYYY to match the reference.
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(date.getDate()).padStart(2, '0');
  return `${dd}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function prettyWorkingType(t) {
  if (!t) return '—';
  const u = String(t).toUpperCase();
  if (u === 'FULL_TIME') return 'Full Time';
  if (u === 'PART_TIME') return 'Part Time';
  // Allow free-text values to pass through unchanged.
  return t;
}

function workingTypeColor(type) {
  if (!type) return COLORS.text;
  return COLORS.green;
}

function prettySalary(s) {
  if (s == null || s === '') return '—';
  const n = Number(String(s).replace(/[^0-9.]/g, ''));
  if (Number.isFinite(n) && n > 0) return `₹ ${n.toLocaleString('en-IN')}`;
  return `₹ ${s}`;
}

function InfoRow({ Icon, label, value, valueColor }) {
  return (
    <View style={styles.infoRow}>
      <Icon size={14} color={COLORS.textMuted} strokeWidth={2} />
      <Text style={styles.infoLabel}>{label} : </Text>
      <Text
        style={[styles.infoValue, valueColor ? { color: valueColor, fontWeight: '800' } : null]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function ExperienceCard({ item }) {
  const isCurrent = !item.relievingDate;
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.photoBox}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Store size={28} color={COLORS.textMuted} />
            </View>
          )}
        </View>

        <View style={styles.detailsCol}>
          <InfoRow Icon={Store}     label="Shop"           value={item.shopName || '—'} valueColor={COLORS.text} />
          <InfoRow Icon={MapPin}    label="Location"       value={item.location || '—'} />
          <InfoRow Icon={Calendar}  label="Join Date"      value={formatDate(item.joinDate)} />
          <InfoRow
            Icon={Calendar}
            label="Relieving Date"
            value={isCurrent ? 'Present' : formatDate(item.relievingDate)}
            valueColor={isCurrent ? COLORS.red : undefined}
          />
          <InfoRow
            Icon={Briefcase}
            label="Working Type"
            value={prettyWorkingType(item.workingType)}
            valueColor={workingTypeColor(item.workingType)}
          />
          <InfoRow Icon={Wallet}    label="Last Salary"    value={prettySalary(item.lastSalary)} />
          <InfoRow Icon={Calendar}  label="Total Duration" value={item.totalDuration || '—'} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat Icon={BarChart3}    label="Total Service" value={item.totalService ?? 0} />
        <View style={styles.statDivider} />
        <Stat Icon={CheckCircle2} label="Completed"     value={item.completedCount ?? 0} />
        <View style={styles.statDivider} />
        <Stat Icon={RotateCcw}    label="Retrun"        value={item.returnCount ?? 0} />
      </View>
    </View>
  );
}

function Stat({ Icon, label, value }) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statHeader}>
        <Icon size={14} color={COLORS.textMuted} strokeWidth={2} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function WorkExperienceScreen() {
  const technicianId = useTechnicianId();
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!technicianId) return;
    setError(null);
    try {
      const data = await getMyExperiences(technicianId);
      setExperiences(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Failed to load work experience');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [technicianId]);

  useEffect(() => {
    if (!technicianId) return;
    setLoading(true);
    load();
  }, [technicianId, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.banner}>
          <View style={styles.bannerBar} />
          <Text style={styles.bannerText}>Experience's</Text>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <AlertCircle size={28} color={COLORS.red} />
            <Text style={[styles.emptyText, { color: COLORS.red }]}>{error}</Text>
          </View>
        ) : experiences.length === 0 ? (
          <View style={styles.stateBox}>
            <Briefcase size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No work experience added yet.</Text>
          </View>
        ) : (
          experiences.map((exp) => <ExperienceCard key={exp.id} item={exp} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 12, paddingBottom: 120 },

  banner: {
    backgroundColor: COLORS.banner,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bannerBar: { width: 3, height: 18, backgroundColor: '#FFFFFF', borderRadius: 2, marginRight: 8 },
  bannerText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  cardTopRow: { flexDirection: 'row', padding: 8 },
  photoBox: {
    width: 96,
    aspectRatio: 1,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
    backgroundColor: '#F1F5F9',
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },

  detailsCol: { flex: 1, justifyContent: 'space-between' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  infoLabel: { fontSize: 11, color: COLORS.textMuted, marginLeft: 6, fontWeight: '500' },
  infoValue: { flex: 1, fontSize: 11, color: COLORS.text, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  statValue: { fontSize: 16, color: COLORS.text, fontWeight: '800', marginTop: 2 },
  statDivider: { width: 1, height: '70%', backgroundColor: COLORS.border },

  stateBox: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
});
