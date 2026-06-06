import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import {
  Bell, MapPin, Camera, Cloud, Sun, Waves, ChevronDown,
  Calendar, Briefcase, Clock,
} from 'lucide-react-native';
import { selectSession, mergeTechnicianProfile } from '../store/authSlice';
import { getCategoriesForSession, getRoleDisplayLabel } from '../config/categories';
import BottomTabBar from '../components/BottomTabBar';
import {
  getMyTechnicianProfile,
  getTodayAttendance,
  getMonthlyAttendance,
  getMyLeaves,
  checkIn as apiCheckIn,
} from '../api/technician';
import { listMyTickets, listTicketEvents } from '../api/tickets';
import { listTechnicianWorkStatuses } from '../api/master';

// Status buckets used to split the "assignedToMe" ticket list into the
// two cards on the home screen. Anything not listed is hidden.
const PENDING_STATUSES = new Set(['CREATED', 'IN_DIAGNOSIS', 'QUOTED']);
const IN_SERVICE_STATUSES = new Set(['APPROVED', 'IN_REPAIR', 'READY']);

const PENDING_NOTE_BY_STATUS = {
  CREATED: 'Awaiting diagnosis',
  IN_DIAGNOSIS: 'Under diagnosis — quotation pending',
  QUOTED: 'Spare part has been ordered. Service is Pending',
};

const IN_SERVICE_NOTE_BY_STATUS = {
  APPROVED: 'Customer approved — repair queued',
  IN_REPAIR: 'Technician Work Started',
  READY: 'Repair complete — awaiting pickup',
};

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function format12hClock(date) {
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return { h: String(h).padStart(2, '0'), m, s, ap };
}

// Backend sends LocalTime as "HH:mm:ss". Render as "09:30 AM".
function formatTimeOfDay(localTime) {
  if (!localTime) return '— : —';
  const parts = String(localTime).split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  if (Number.isNaN(h)) return '— : —';
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${ap}`;
}

function formatLongDate(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// "06-Feb-2026" — matches the design.
function formatShortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

// "06-Feb-2026 01:21 PM"
function formatShortDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${formatShortDate(iso)} ${String(h).padStart(2, '0')}:${m} ${ap}`;
}

function shortMonthYear(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function daysInMonth(year, month1based) {
  return new Date(year, month1based, 0).getDate();
}

function initialsFromName(name) {
  if (!name) return 'E';
  return name.trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
}

function employeeIdFromSession(session) {
  if (session?.employeeId) return session.employeeId;
  const techId = session?.technicianId;
  if (techId) return `EM-${String(techId).replace(/-/g, '').slice(0, 5).toUpperCase()}`;
  if (session?.userId) return `EM-${String(session.userId).replace(/-/g, '').slice(0, 5).toUpperCase()}`;
  return 'EM-00000';
}

function ticketRef(t) {
  if (t.trackingId) return `#${t.trackingId}`;
  return `#${String(t.id).replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export default function HomeScreen({ navigation }) {
  const dispatch = useDispatch();
  const session = useSelector(selectSession);
  const now = useClock();
  const time = format12hClock(now);
  const categories = useMemo(() => getCategoriesForSession(session), [session]);
  const roleLabel = getRoleDisplayLabel(session);
  const displayName = session?.fullName || session?.email || roleLabel;

  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [todayAttendance, setTodayAttendance] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [errors, setErrors] = useState({});
  // Code -> Label map sourced from the admin's Work Status master list. Used to
  // resolve the latest event on each displayed ticket into the same label the
  // technician sees in the detail-screen "Technician Work Status" dropdown.
  const [workStatusLabels, setWorkStatusLabels] = useState({});
  // Latest matching work-status code on each displayed ticket. Null when the
  // ticket has no events yet (e.g. unassigned) or no event matches a row in
  // the master list — in which case the card falls back to the hardcoded note.
  const [pendingLatestCode, setPendingLatestCode] = useState(null);
  const [inServiceLatestCode, setInServiceLatestCode] = useState(null);

  const loadFromTechnicianId = useCallback(async (techId) => {
    try {
      const [att, lvs] = await Promise.all([
        getMonthlyAttendance(techId, month, year).catch((e) => { setErrors((s) => ({ ...s, monthly: e?.message })); return null; }),
        getMyLeaves(techId).catch((e) => { setErrors((s) => ({ ...s, leaves: e?.message })); return []; }),
      ]);
      if (att) setMonthly(att);
      if (Array.isArray(lvs)) setLeaves(lvs);
    } catch (_) {}
  }, [month, year]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await getMyTechnicianProfile();
        if (!active) return;
        dispatch(mergeTechnicianProfile(me));
        if (me?.id) loadFromTechnicianId(me.id);
      } catch (e) {
        setErrors((s) => ({ ...s, profile: e?.message }));
      }

      try {
        const today = await getTodayAttendance();
        if (active && today) setTodayAttendance(today);
      } catch (e) {
        setErrors((s) => ({ ...s, today: e?.message }));
      }

      try {
        const page = await listMyTickets({ page: 0, size: 20 });
        if (active) setTickets(Array.isArray(page?.content) ? page.content : (Array.isArray(page) ? page : []));
      } catch (e) {
        setErrors((s) => ({ ...s, tickets: e?.message }));
      } finally {
        if (active) setTicketsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [dispatch, loadFromTechnicianId]);

  const handleCheckInPress = async () => {
    if (checkInBusy) return;
    setCheckInBusy(true);
    try {
      const updated = await apiCheckIn();
      if (updated) setTodayAttendance(updated);
    } catch (e) {
      setErrors((s) => ({ ...s, checkin: e?.message }));
    } finally {
      setCheckInBusy(false);
    }
  };

  // Derived view-model values
  const checkInLabel = formatTimeOfDay(todayAttendance?.checkInTime);
  const checkOutLabel = formatTimeOfDay(todayAttendance?.checkOutTime);
  const monthLabel = shortMonthYear(now);

  const present = monthly?.presentDays ?? 0;
  const leaveDays = monthly?.leaveDays ?? 0;
  const permission = monthly?.permissionCount ?? 0;
  const lateHrs = monthly?.lateHours ?? '0.00';
  const totalDays = monthly ? daysInMonth(year, month) : daysInMonth(year, month);
  const progressPct = totalDays > 0 ? Math.min(100, Math.round((present / totalDays) * 100)) : 0;

  const pendingTicket = useMemo(
    () => tickets.find((t) => PENDING_STATUSES.has(t.status)),
    [tickets],
  );
  const inServiceTicket = useMemo(
    () => tickets.find((t) => IN_SERVICE_STATUSES.has(t.status)),
    [tickets],
  );

  // Load the admin's Work Status master list once so we can render the same
  // labels the technician sees on the detail screen. Failing here is non-fatal:
  // the cards fall back to the hardcoded notes if the map is empty.
  useEffect(() => {
    let active = true;
    listTechnicianWorkStatuses().then((rows) => {
      if (!active) return;
      const map = {};
      (Array.isArray(rows) ? rows : []).forEach((r) => {
        const code = String(r.code || r.statusCode || '').toUpperCase();
        const label = r.label || r.displayLabel || r.name;
        if (code && label) map[code] = label;
      });
      setWorkStatusLabels(map);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Pull the latest matching work-status event for each visible card so the
  // label reflects the technician's actual current step (e.g. "Parts Required",
  // "Quality Check Started") instead of a stale ticket-level fallback.
  useEffect(() => {
    let active = true;
    const resolveLatest = async (ticketId) => {
      if (!ticketId) return null;
      try {
        const rows = await listTicketEvents(ticketId);
        const list = Array.isArray(rows) ? rows : [];
        // Events come back asc by createdAt; walk from the end and keep the
        // first event whose code exists in the master map.
        for (let i = list.length - 1; i >= 0; i--) {
          const code = String(list[i]?.status || '').toUpperCase();
          if (code && workStatusLabels[code]) return code;
        }
        return null;
      } catch { return null; }
    };
    (async () => {
      const [pCode, sCode] = await Promise.all([
        resolveLatest(pendingTicket?.id),
        resolveLatest(inServiceTicket?.id),
      ]);
      if (!active) return;
      setPendingLatestCode(pCode);
      setInServiceLatestCode(sCode);
    })();
    return () => { active = false; };
  }, [pendingTicket?.id, inServiceTicket?.id, workStatusLabels]);

  const pendingLabel = pendingLatestCode && workStatusLabels[pendingLatestCode]
    ? workStatusLabels[pendingLatestCode]
    : (pendingTicket ? (PENDING_NOTE_BY_STATUS[pendingTicket.status] || 'Pending') : '');
  const inServiceLabel = inServiceLatestCode && workStatusLabels[inServiceLatestCode]
    ? workStatusLabels[inServiceLatestCode]
    : (inServiceTicket ? (IN_SERVICE_NOTE_BY_STATUS[inServiceTicket.status] || inServiceTicket.status) : '');
  const recentLeave = useMemo(() => {
    if (!leaves.length) return null;
    return [...leaves].sort((a, b) => {
      const ta = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const tb = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return tb - ta;
    })[0];
  }, [leaves]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-4 pt-2 pb-3 flex-row items-center">
          <Avatar uri={session?.photoUrl} name={displayName} />
          <View className="flex-1 ml-3">
            <Text className="text-[17px] font-extrabold text-text">{displayName}</Text>
            <Text className="text-[12px] text-text-muted mt-0.5">ID: {employeeIdFromSession(session)}</Text>
          </View>
          <Pressable hitSlop={10} className="h-10 w-10 rounded-full items-center justify-center bg-card border border-border">
            <Bell size={18} color="#0F172A" />
          </Pressable>
        </View>

        {/* Check In / Check Out cards */}
        <View className="px-4 flex-row">
          <CheckCard
            icon={<View className="flex-row items-end"><Sun size={20} color="#F59E0B" /><Cloud size={18} color="#60A5FA" style={{ marginLeft: -6 }} /></View>}
            label="CHECK IN"
            time={checkInLabel}
            timeColor="#16A34A"
          />
          <View className="w-3" />
          <CheckCard
            icon={<View className="flex-row items-end"><Sun size={20} color="#F59E0B" /><Waves size={18} color="#60A5FA" style={{ marginLeft: -2 }} /></View>}
            label="CHECK OUT"
            time={checkOutLabel}
            timeColor="#DC2626"
          />
        </View>

        {/* Date + Location */}
        <View className="px-4 mt-3 flex-row items-center justify-between">
          <Text className="text-[13px] text-text">{formatLongDate(now)}</Text>
          <View className="flex-row items-center bg-primary/10 rounded-full px-3 py-1.5">
            <MapPin size={13} color="#00008B" />
            <Text className="text-[12px] text-primary font-semibold ml-1">Cuddalore, Tamil Nadu</Text>
          </View>
        </View>

        {/* Live Check-In card */}
        <View className="mx-4 mt-3 bg-card rounded-2xl border border-border p-4"
              style={{ shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
          <View className="flex-row items-start">
            <View className="flex-1">
              <Text className="text-[18px] font-extrabold text-text tracking-wider">
                {time.h} : {time.m} : {time.s} {time.ap}
              </Text>
              <Pressable
                onPress={handleCheckInPress}
                disabled={checkInBusy}
                className="mt-3 bg-primary rounded-xl px-6 py-2.5 self-start"
                style={{ opacity: checkInBusy ? 0.6 : 1 }}
              >
                {checkInBusy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-[13px]">Check In</Text>}
              </Pressable>
            </View>
            <View className="items-end">
              <View className="flex-row items-center">
                <Camera size={14} color="#16A34A" />
                <Text className="text-[13px] text-text font-semibold ml-1">Face Recognition</Text>
              </View>
              <View className="mt-2 bg-text-muted/30 rounded-md px-4 py-1">
                <Text className="text-[12px] text-text font-bold">Blocked</Text>
              </View>
              <Text className="text-[10px] text-danger font-semibold mt-1.5">Shop 0 Meter Range UnBlock *</Text>
            </View>
          </View>
        </View>

        {/* Categories */}
        <View className="px-4 mt-5">
          <Text className="text-[18px] font-extrabold text-text">Categories</Text>
          <View className="flex-row flex-wrap mt-3 -mx-1">
            {categories.map((c) => {
              const Icon = c.icon;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => navigation.navigate(c.route)}
                  className="w-1/4 px-1 mb-4 items-center"
                >
                  <View className="h-14 w-14 rounded-full bg-primary items-center justify-center">
                    <Icon size={24} color="#FFFFFF" strokeWidth={2} />
                  </View>
                  <Text className="text-[12px] font-bold text-text mt-2 text-center leading-4">{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* This Month */}
        <View className="mx-4 mt-2 bg-card rounded-2xl border border-border p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-[16px] font-extrabold text-text">This Month</Text>
            <Pressable className="flex-row items-center bg-background border border-border rounded-lg px-3 py-1.5">
              <Calendar size={14} color="#0F172A" />
              <Text className="text-[12px] text-text font-semibold ml-1.5">{monthLabel}</Text>
              <ChevronDown size={14} color="#0F172A" style={{ marginLeft: 4 }} />
            </Pressable>
          </View>

          <View className="h-2 bg-background rounded-full mt-3 overflow-hidden">
            <View className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-[12px]"><Text className="text-primary font-bold">{present}</Text> <Text className="text-text-muted">Present</Text></Text>
            <Text className="text-[12px]"><Text className="text-text font-bold">{present}</Text><Text className="text-text-muted"> / {totalDays}</Text></Text>
          </View>

          <View className="flex-row mt-4 -mx-1">
            <StatTile color="#EEF2FF" iconColor="#00008B" icon={Calendar} value={String(present).padStart(2, '0')} label="Present" />
            <StatTile color="#FFF7ED" iconColor="#F59E0B" icon={Briefcase} value={String(leaveDays).padStart(2, '0')} label="Leave" />
            <StatTile color="#EEF2FF" iconColor="#00008B" icon={Calendar} value={String(permission).padStart(2, '0')} label="Permission" />
            <StatTile color="#EEF2FF" iconColor="#00008B" icon={Clock} value={String(lateHrs)} label="Late Hrs" />
          </View>
        </View>

        {/* Recent Pending */}
        <View className="px-4 mt-5">
          <Text className="text-[16px] font-extrabold text-text mb-2">Recent Pending</Text>
          {ticketsLoading ? (
            <SectionLoader />
          ) : pendingTicket ? (
            <PendingCard
              ticket={pendingTicket}
              note={pendingLabel}
              onPress={() => navigation.navigate('TechnicianTicketDetail', { ticketId: pendingTicket.id })}
            />
          ) : (
            <EmptyCard text="No pending tickets" />
          )}
        </View>

        {/* Assign & In Service Process */}
        <View className="px-4 mt-5">
          <Text className="text-[16px] font-extrabold text-text mb-2">Assign & In Service Process</Text>
          {ticketsLoading ? (
            <SectionLoader />
          ) : inServiceTicket ? (
            <InServiceCard
              ticket={inServiceTicket}
              note={inServiceLabel}
              onPress={() => navigation.navigate('TechnicianTicketDetail', { ticketId: inServiceTicket.id })}
            />
          ) : (
            <EmptyCard text="No tickets in service" />
          )}
        </View>

        {/* Recent Leave Request */}
        <View className="px-4 mt-5">
          <Text className="text-[16px] font-extrabold text-text mb-2">Recent Leave Request</Text>
          {recentLeave ? (
            <LeaveCard leave={recentLeave} />
          ) : (
            <EmptyCard text="No leave requests yet" />
          )}
        </View>
      </ScrollView>

      <BottomTabBar active="Home" navigation={navigation} />
    </SafeAreaView>
  );
}

function Avatar({ uri, name }) {
  if (uri) return <Image source={{ uri }} className="h-12 w-12 rounded-full" />;
  return (
    <View className="h-12 w-12 rounded-full bg-primary items-center justify-center">
      <Text className="text-white font-extrabold text-[15px]">{initialsFromName(name)}</Text>
    </View>
  );
}

function CheckCard({ icon, label, time, timeColor }) {
  return (
    <View className="flex-1 bg-card rounded-2xl border border-border px-3 py-3 flex-row items-center"
          style={{ shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
      <View className="h-9 w-9 rounded-full bg-background items-center justify-center mr-2">
        {icon}
      </View>
      <View className="flex-1 items-center">
        <Text className="text-[11px] font-bold text-text tracking-wide">{label}</Text>
        <Text className="text-[15px] font-extrabold mt-0.5" style={{ color: timeColor }}>{time}</Text>
      </View>
    </View>
  );
}

function StatTile({ color, iconColor, icon: Icon, value, label }) {
  return (
    <View className="flex-1 mx-1 rounded-xl p-2.5" style={{ backgroundColor: color }}>
      <View className="flex-row items-center">
        <Icon size={16} color={iconColor} />
        <Text className="text-[15px] font-extrabold text-text ml-2">{value}</Text>
      </View>
      <Text className="text-[11px] text-text-muted mt-1">{label}</Text>
    </View>
  );
}

function PendingCard({ ticket, note, onPress }) {
  return (
    <Pressable onPress={onPress} className="bg-card rounded-2xl border border-border p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[12px] text-text font-semibold">{formatShortDate(ticket.createdAt)}</Text>
        <Text className="text-[12px] text-primary font-bold">{ticketRef(ticket)}</Text>
      </View>
      <Text className="text-[13px] text-text font-semibold mt-2" numberOfLines={2}>
        {ticket.deviceDisplayName || 'Device'}
        {ticket.repairServicesSummary ? ` - ${ticket.repairServicesSummary}` : ''}
      </Text>
      <Text className="text-[12px] text-danger font-semibold mt-1">{note}</Text>
      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-[11px] text-text-muted">Pending On {formatShortDateTime(ticket.updatedAt || ticket.createdAt)}</Text>
        <View className="h-4 w-4 rounded-full bg-danger" style={{ opacity: 0.85 }} />
      </View>
    </Pressable>
  );
}

function InServiceCard({ ticket, note, onPress }) {
  return (
    <Pressable onPress={onPress} className="bg-card rounded-2xl border border-border p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[12px] text-text font-semibold">{formatShortDate(ticket.createdAt)}</Text>
        <Text className="text-[12px] text-primary font-bold">{ticketRef(ticket)}</Text>
      </View>
      <Text className="text-[13px] text-text font-semibold mt-2" numberOfLines={2}>
        {ticket.deviceDisplayName || 'Device'}
        {ticket.repairServicesSummary ? ` - ${ticket.repairServicesSummary}` : ''}
      </Text>
      <Text className="text-[12px] text-info font-semibold mt-1">{note}</Text>
      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-[11px] text-text-muted">In Service Process On {formatShortDateTime(ticket.updatedAt || ticket.createdAt)}</Text>
        <View className="h-6 w-6 rounded-full bg-info/15 items-center justify-center">
          <Text className="text-info text-[11px]">↻</Text>
        </View>
      </View>
    </Pressable>
  );
}

function LeaveCard({ leave }) {
  const requestedAt = leave.requestedAt ? new Date(leave.requestedAt) : null;
  const requestedAtLabel = requestedAt
    ? `${requestedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${requestedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    : '—';
  const startDateLabel = leave.startDate
    ? new Date(leave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  const status = leave.status || 'PROCESSING';
  const statusColor = status === 'APPROVED' ? '#10B981' : status === 'REJECTED' ? '#EF4444' : '#F59E0B';
  const statusBg = status === 'APPROVED' ? 'rgba(16, 185, 129, 0.15)' : status === 'REJECTED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
  const statusText = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <View className="bg-card rounded-2xl border border-border p-4 flex-row">
      <View className="w-1 bg-primary rounded-full mr-3" />
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-[13px] text-text font-bold">{startDateLabel}</Text>
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: statusBg }}>
            <Text className="text-[11px] font-bold" style={{ color: statusColor }}>{statusText}</Text>
          </View>
        </View>
        <View className="flex-row justify-between mt-3">
          <ColLabel value={leave.reason || '—'} label="Leave Reason" />
          <ColLabel value={leave.appliedDaysLabel || '—'} label="Applied Days" align="center" />
          <ColLabel value={requestedAtLabel} label="Request Date & Time" align="right" />
        </View>
      </View>
    </View>
  );
}

function ColLabel({ value, label, align = 'left' }) {
  const alignClass = align === 'center' ? 'items-center' : align === 'right' ? 'items-end' : 'items-start';
  return (
    <View className={alignClass} style={{ maxWidth: '34%' }}>
      <Text className="text-[12px] font-bold text-text" numberOfLines={2}>{value}</Text>
      <Text className="text-[10px] text-text-muted mt-0.5">{label}</Text>
    </View>
  );
}

function SectionLoader() {
  return (
    <View className="bg-card rounded-2xl border border-border p-6 items-center">
      <ActivityIndicator color="#00008B" />
    </View>
  );
}

function EmptyCard({ text }) {
  return (
    <View className="bg-card rounded-2xl border border-border p-4 items-center">
      <Text className="text-[12px] text-text-muted">{text}</Text>
    </View>
  );
}
