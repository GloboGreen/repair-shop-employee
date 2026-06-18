// Technician-side service history timeline.
//
// Mirrors ggfix-shop-app/src/screens/common/serviceHistoryPhases.js so the
// technician sees the same rail the shop owner and customer see. Source of
// truth for the status list lives there — keep this file in sync when rows
// are added/removed (any new row must already exist on the customer/owner
// list before it's added here).
import React, { useEffect, useRef, useState } from 'react';
import { Text, View, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import { Truck, Wrench, Play, Pause } from 'lucide-react-native';

const PICKUP = 'PICKUP';
const SERVICE = 'SERVICE';

export const SHOP_BOOKING_STATUS_OPTIONS = [
  // Pickup phase
  { value: 'PICKUP_BOOKING_CREATED',                        label: 'Pickup Booking Created',                phase: PICKUP },
  { value: 'PICKUP_PERSON_ASSIGNED',                        label: 'Pickup Person Assigned',                phase: PICKUP },
  { value: 'PICKUP_ON_THE_WAY',                             label: 'Pickup Person On The Way',              phase: PICKUP },
  { value: 'REACHED_CUSTOMER_LOCATION',                     label: 'Reached Customer Location',             phase: PICKUP },
  { value: 'REPAIR_ESTIMATE_PROCESSING',                    label: 'Repair Estimate Processing',            phase: PICKUP },
  { value: 'DEVICE_PICKED_UP',                              label: 'Device Picked Up',                      phase: PICKUP },
  { value: 'REACHED_SHOP',                                  label: 'Pickup Person Reached Shop',            phase: PICKUP },
  { value: 'RECEIVED_AT_SHOP',                              label: 'Device Received at Shop',               phase: PICKUP },
  // Service phase
  { value: 'BOOKING_CREATED_BY_SHOP',                       label: 'Booking Created by Shop',               phase: SERVICE },
  { value: 'SERVICE_ACCEPTED',                              label: 'Service Accepted',                      phase: SERVICE },
  { value: 'ASSIGNED_TO_TECHNICIAN',                        label: 'Assigned to Technician',                phase: SERVICE },
  { value: 'AWAITING_TECHNICIAN_ACCEPTANCE',                label: 'Awaiting Technician Acceptance',        phase: SERVICE },
  { value: 'REASSIGNED_TO_TECHNICIAN',                      label: 'Re-Assigned to Technician',             phase: SERVICE },
  { value: 'TECHNICIAN_ACCEPTED_SERVICE',                   label: 'Technician Accepted Service',           phase: SERVICE },
  { value: 'TECHNICIAN_WORK_STARTED',                       label: 'Technician Work Started',               phase: SERVICE },
  { value: 'TECHNICIAN_UPLOADED_DEVICE_IMAGES',             label: 'Technician Uploaded Device Images',     phase: SERVICE },
  { value: 'TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED',  label: 'Technician Issue Verified & Updated',   phase: SERVICE },
  { value: 'RE_ESTIMATED_CONFIRMED',                        label: 'Service Re-estimated',                  phase: SERVICE },
  { value: 'CUSTOMER_APPROVED',                             label: 'Customer Approved',                     phase: SERVICE },
  { value: 'CUSTOMER_REJECTED',                             label: 'Customer Rejected',                     phase: SERVICE },
  { value: 'IN_REPAIR',                                     label: 'Repair Work In Progress',               phase: SERVICE },
  { value: 'PARTS_REQUIRED',                                label: 'Spare Parts Waiting',                   phase: SERVICE },
  { value: 'PARTS_REPLACED',                                label: 'Spare Parts Replaced',                  phase: SERVICE },
  { value: 'QUALITY_CHECK_STARTED',                         label: 'Quality Check Started',                 phase: SERVICE },
  { value: 'QUALITY_CHECK_COMPLETED',                       label: 'Quality Check Completed',               phase: SERVICE },
  { value: 'REPAIR_COMPLETED',                              label: 'Repair Completed',                      phase: SERVICE },
  { value: 'REPAIR_NOT_COMPLETED',                          label: 'Repair Not Completed',                  phase: SERVICE },
  { value: 'INVOICE_GENERATED',                             label: 'Invoice Generated',                     phase: SERVICE },
  { value: 'READY',                                         label: 'Ready for Delivery',                    phase: SERVICE },
  { value: 'RETURN_DELIVERY',                               label: 'Return Delivery',                       phase: SERVICE },
  { value: 'DELIVERED',                                     label: 'Delivered to Customer',                 phase: SERVICE },
  { value: 'CANCELLED',                                     label: 'Repair Cancelled',                      phase: SERVICE },
];

const LABEL_BY_KEY = Object.fromEntries(
  SHOP_BOOKING_STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

const SUCCESS = '#10B981';
const BRAND_GREEN_DARK = '#15803D';
const DOT_BORDER = '#CBD5E1';
const LINE_PENDING = '#E2E8F0';

const PHASE_META = {
  PICKUP: {
    title: 'Pickup Service',
    subtitle: 'Doorstep pickup by our pickup person',
    icon: Truck,
    tint: '#DBEAFE',
    accent: '#1D4ED8',
  },
  SERVICE: {
    title: 'Shop Service',
    subtitle: 'Booking + repair lifecycle at the shop',
    icon: Wrench,
    tint: '#DCFCE7',
    accent: BRAND_GREEN_DARK,
  },
};

function PhaseHeader({ phaseKey, anyDone }) {
  const meta = PHASE_META[phaseKey];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <View className="flex-row items-center mb-3 mt-1">
      <View
        className="w-9 h-9 rounded-full items-center justify-center mr-2.5"
        style={{ backgroundColor: meta.tint }}
      >
        <Icon size={16} color={meta.accent} />
      </View>
      <View className="flex-1">
        <Text className="text-[13px] font-extrabold" style={{ color: meta.accent }}>
          {meta.title}
        </Text>
        <Text className="text-[10.5px] text-gray-500 mt-0.5">{meta.subtitle}</Text>
      </View>
      {anyDone ? (
        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: meta.tint }}>
          <Text className="text-[9.5px] font-extrabold" style={{ color: meta.accent }}>STARTED</Text>
        </View>
      ) : null}
    </View>
  );
}

function EventMedia({ audioUrl, imageUrls }) {
  const hasAudio = !!audioUrl;
  const hasImages = Array.isArray(imageUrls) && imageUrls.length > 0;
  if (!hasAudio && !hasImages) return null;

  const soundRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => {
    try { soundRef.current?.unloadAsync?.(); } catch (_) {}
  }, []);

  const togglePlay = async () => {
    try {
      if (playing && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
        return;
      }
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch (_) {}
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s?.didJustFinish) setPlaying(false);
      });
      await sound.playAsync();
      setPlaying(true);
    } catch (_) { /* swallow — best-effort playback */ }
  };

  return (
    <View className="mt-1.5">
      {hasAudio ? (
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={togglePlay}
            className="flex-row items-center rounded-md px-2 py-1"
            style={{ borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' }}
          >
            {playing
              ? <Pause size={12} color="#0F172A" />
              : <Play size={12} color="#0F172A" />}
            <Text className="text-[10px] text-text ml-1">Voice note</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {hasImages ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-1.5">
          <View className="flex-row">
            {imageUrls.map((u, j) => (
              <Image
                key={j}
                source={{ uri: u }}
                style={{ width: 56, height: 56, borderRadius: 6, marginRight: 6 }}
              />
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function fmt(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function ServiceHistoryTimeline({ events, status, phaseFilter }) {
  const eventByStatus = {};
  (events || []).forEach((e) => {
    const k = (e.status || '').toUpperCase();
    if (!eventByStatus[k]) eventByStatus[k] = e;
  });

  const visibleOptions = phaseFilter
    ? SHOP_BOOKING_STATUS_OPTIONS.filter((o) => o.phase === phaseFilter)
    : SHOP_BOOKING_STATUS_OPTIONS;

  const sortedByTime = (events || []).slice().sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
  const latestKey = (sortedByTime[0]?.status || '').toUpperCase();
  let currentIndex = visibleOptions.findIndex((o) => o.value === latestKey);
  if (currentIndex < 0) {
    visibleOptions.forEach((opt, i) => {
      if (eventByStatus[opt.value]) currentIndex = i;
    });
  }

  const pickupRows  = visibleOptions.filter((o) => o.phase === PICKUP);
  const serviceRows = visibleOptions.filter((o) => o.phase === SERVICE);
  const anyPickupDone  = pickupRows.some((r) => !!eventByStatus[r.value]);
  const anyServiceDone = serviceRows.some((r) => !!eventByStatus[r.value]);
  const visibleGroups = [];
  if (pickupRows.length && (phaseFilter === PICKUP || anyPickupDone)) {
    visibleGroups.push({ phase: PICKUP, rows: pickupRows, anyDone: anyPickupDone });
  }
  if (serviceRows.length) {
    visibleGroups.push({ phase: SERVICE, rows: serviceRows, anyDone: anyServiceDone });
  }

  const indexByValue = Object.fromEntries(
    visibleOptions.map((o, i) => [o.value, i]),
  );

  return (
    <View>
      {visibleGroups.map((group, gi) => (
        <View
          key={group.phase}
          className="mb-2"
          style={
            gi > 0
              ? { paddingTop: 14, marginTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' }
              : null
          }
        >
          <PhaseHeader phaseKey={group.phase} anyDone={group.anyDone} />
          {group.rows.map((opt, idx) => {
            const ev = eventByStatus[opt.value];
            const completed = !!ev;
            const globalIdx = indexByValue[opt.value];
            const isCurrent = globalIdx === currentIndex && completed;
            const isLast = idx === group.rows.length - 1;
            const nextOpt = group.rows[idx + 1];
            const nextCompleted = nextOpt ? !!eventByStatus[nextOpt.value] : false;
            const lineCompleted = completed && nextCompleted;
            return (
              <View key={opt.value} className="flex-row">
                <View className="items-center mr-3" style={{ width: 18 }}>
                  <View
                    style={{
                      width: 14, height: 14, borderRadius: 7,
                      backgroundColor: completed ? SUCCESS : '#FFFFFF',
                      borderWidth: completed ? 0 : 2, borderColor: DOT_BORDER,
                      marginTop: 2,
                    }}
                  />
                  {!isLast ? (
                    <View
                      className="flex-1 my-1"
                      style={{ width: 2, backgroundColor: lineCompleted ? SUCCESS : LINE_PENDING }}
                    />
                  ) : null}
                </View>
                <View className="flex-1 pb-4">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-[13px] flex-1 pr-2 ${
                        completed ? 'font-extrabold text-text' : 'font-bold text-text-muted'
                      }`}
                    >
                      {opt.label}
                    </Text>
                    {isCurrent ? (
                      <View
                        className="rounded-full px-1.5 py-0.5 ml-1"
                        style={{ backgroundColor: '#DCFCE7' }}
                      >
                        <Text className="text-[8px] font-extrabold" style={{ color: BRAND_GREEN_DARK }}>
                          NOW
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {ev?.createdAt ? (
                    <Text className="text-[10px] text-text-muted mt-1">{fmt(ev.createdAt)}</Text>
                  ) : null}
                  {ev?.note && ev.note !== opt.label ? (
                    <Text className="text-[11px] text-text mt-0.5">{ev.note}</Text>
                  ) : null}
                  <EventMedia audioUrl={ev?.audioUrl} imageUrls={ev?.imageUrls} />
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function getCurrentPhaseLabel(events, status) {
  const sorted = (events || []).slice().sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
  const latest = sorted[0];
  const key = (latest?.status || '').toUpperCase();
  if (LABEL_BY_KEY[key]) return LABEL_BY_KEY[key];
  const statusUpper = (status || '').toUpperCase();
  if (LABEL_BY_KEY[statusUpper]) return LABEL_BY_KEY[statusUpper];
  return latest?.note || (status || '').replace(/_/g, ' ');
}
