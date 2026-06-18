import React, { useState } from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '../components/rnr';
import { notify } from '../components/confirm';
import { submitPickupRepairEstimate } from '../api/pickups';
import { normalizeDeviceImageUrl } from '../utils/images';

function trackingId(booking, params) {
  return params?.trackingId
    || booking?.bookingNumber
    || `#${String(booking?.id || '').replace(/[^0-9a-zA-Z]/g, '').slice(0, 12).toUpperCase()}`;
}

function deviceTitle(booking, params) {
  const parts = [];
  const brand = params?.brandName || params?.brand?.name || booking?.brandName;
  const model = params?.modelName || params?.model?.name || booking?.modelName;
  if (brand) parts.push(brand);
  if (model) parts.push(model);
  const head = parts.join(' ');
  const specs = [];
  const ramLabel = params?.ramLabel || booking?.ramLabel;
  const storageLabel = params?.storageLabel || booking?.storageLabel;
  if (ramLabel) specs.push(ramLabel);
  if (storageLabel) specs.push(storageLabel);
  if (specs.length === 0) return head;
  return head ? `${head} · ${specs.join(' · ')}` : specs.join(' · ');
}

// Backend now persists imei + schedule + device_pin + missing parts + customer
// approval in dedicated repair_bookings columns, and services in
// repair_booking_services. issueSummary stays clean — just the complaint text.

function base64ImageUri(raw) {
  if (!raw) return null;
  const value = String(raw);
  return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
}

function deviceImageUri(booking, params) {
  const url = normalizeDeviceImageUrl(
    params?.modelImageUrl
      || params?.model?.imageUrl
      || booking?.deviceImageUrl
      || booking?.modelImageUrl
  );
  if (url) return url;
  return base64ImageUri(
    params?.modelImageBase64
      || params?.model?.imageBase64
      || booking?.deviceImageBase64
      || booking?.modelImageBase64
  );
}

export default function PickupServiceBookingDevicesListScreen({ navigation, route }) {
  const params = route?.params || {};
  const booking = params.booking || null;
  const bookingId = params.bookingId || booking?.id;
  const services = params.services || [];
  const photos = params.devicePhotos || {};
  const total = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const imageUri = deviceImageUri(booking, params);
  const colorText = params.color || booking?.color || null;
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!bookingId) { notify('Missing', 'Booking is required'); return; }
    if (!services.length) { notify('Missing services', 'Select at least one repair service.'); return; }
    setSubmitting(true);
    try {
      // Translate the multi-step flow's locally-shaped state into the keys
      // submitPickupRepairEstimate actually reads on the backend. Key names
      // that don't match (devicePin vs lock.value, customerApproval vs
      // customerApproved, missingDamageParts vs missingParts of partName
      // shape) silently fall through the COALESCE and leave those columns
      // NULL on repair_bookings — which is what caused the owner-side
      // "View Details" to render PIN / missing parts / approval as blank.
      const devicePin = params.lock && params.lock.type && params.lock.type !== 'NONE'
        ? (params.lock.value || null)
        : null;
      const missingPartsCsv = Array.isArray(params.missingParts)
        ? params.missingParts
            .map((p) => {
              const name = p?.partName || p?.name || p?.label;
              if (!name) return null;
              const flags = [];
              if (p?.missing) flags.push('missing');
              if (p?.damage) flags.push('damaged');
              return flags.length ? `${name} (${flags.join(', ')})` : name;
            })
            .filter(Boolean)
            .join(', ')
        : null;
      const customerApprovalValue = params.customerApproved == null
        ? null
        : (params.customerApproved ? 'DONE' : 'PENDING');

      const body = {
        estimatedRepairValue: total,
        frontImageUrl: photos.front || null,
        backImageUrl: photos.back || null,
        videoUrl: photos.video || null,
        issueSummary: params.complaint ? params.complaint.trim() : null,
        // Pickup-person-confirmed device taxonomy. Backend persists these
        // onto repair_bookings (brand_id / model_id / ram_option_id /
        // storage_option_id / color) so subsequent screens — and the
        // customer's MyOrders view — show the corrected device.
        brandId: params.brandId || params.brand?.id || null,
        modelId: params.modelId || params.model?.id || null,
        ramOptionId: params.ramOptionId || null,
        storageOptionId: params.storageOptionId || null,
        color: colorText,
        // Repair-services list — backend DELETE-then-INSERTs repair_booking_services
        // from this array (see PickupBookingController.submitRepairEstimate).
        services,
        imei: params.imei || null,
        // Schedule + device-condition fields — match the names backend reads.
        estimatedReadyAt: params.estimatedReadyIso || null,
        estimatedDeliveryAt: params.estimatedDeliveryIso || null,
        devicePin,
        missingDamageParts: missingPartsCsv,
        customerApproval: customerApprovalValue,
      };
      await submitPickupRepairEstimate(bookingId, body);
      notify('Estimate submitted', 'Repair estimate saved for this booking.');
      navigation.popToTop();
    } catch (e) {
      notify('Submit failed', e?.message || 'Could not save repair estimate.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-4 pt-3 pb-32">
        <Card className="mb-2.5 p-0 overflow-hidden">
          <View className="flex-row items-center px-2.5 py-2">
            <View className="w-11 h-12 bg-border rounded-md overflow-hidden items-center justify-center">
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={{ width: 44, height: 48 }} resizeMode="cover" />
              ) : (
                <Ionicons name="phone-portrait-outline" size={20} color="#64748B" />
              )}
            </View>
            <View className="ml-2.5 flex-1">
              <Text className="text-text-muted text-[10px]">Tracking ID : <Text className="font-bold text-text text-[12px]">{trackingId(booking, params)}</Text></Text>
              {deviceTitle(booking, params) ? (
                <Text className="text-text-muted text-[10px] mt-0.5">Device : <Text className="font-bold text-text text-[12px]">{deviceTitle(booking, params)}</Text></Text>
              ) : null}
              {colorText ? (
                <Text className="text-text-muted text-[10px] mt-0.5">Color : <Text className="font-bold text-text text-[12px]">{colorText}</Text></Text>
              ) : null}
              {booking?.customerName ? (
                <Text className="text-text-muted text-[10px] mt-0.5">Customer : <Text className="font-bold text-text text-[12px]">{booking.customerName}</Text></Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </View>
          <View className="px-2.5 pb-2">
            <Text className="text-text-muted text-[10px] mb-0.5">Repair Services</Text>
            {services.map((s, i) => (
              <View key={i} className="flex-row items-center my-0.5">
                <View className="w-5 h-5 bg-background rounded items-center justify-center mr-2">
                  <Text className="text-text text-[10px] font-bold">{i + 1}</Text>
                </View>
                <Text className="flex-1 text-text text-[12px]" numberOfLines={1}>{s.serviceName}</Text>
                <Text className="font-bold text-text text-[12px]">₹{Number(s.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
            ))}
            <View className="border-t border-border mt-1.5 pt-1.5 flex-row items-center">
              <Text className="flex-1 font-bold text-text text-[12px]">Estimated Repair Amount</Text>
              <Text className="font-bold text-text text-[12px]">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </Card>

        {params.imei ? (
          <Card className="mb-2.5">
            <Text className="text-text-muted text-[10px]">IMEI</Text>
            <Text className="font-bold text-text text-[12px] mt-0.5">{params.imei}</Text>
          </Card>
        ) : null}

        {params.lock?.type && params.lock.type !== 'NONE' ? (
          <Card className="mb-2.5">
            <Text className="text-text-muted text-[10px]">Device Security</Text>
            <Text className="font-bold text-text text-[12px] mt-0.5">{params.lock.type}</Text>
          </Card>
        ) : null}

        {Array.isArray(params.missingParts) && params.missingParts.length > 0 ? (
          <Card className="mb-2.5">
            <Text className="text-text-muted text-[10px] mb-1">Missing / Damaged Parts</Text>
            {params.missingParts.map((p, i) => (
              <Text key={i} className="text-text text-[12px]">
                • {p.partName} {p.missing ? '(missing)' : ''}{p.missing && p.damage ? ', ' : ''}{p.damage ? '(damaged)' : ''}
              </Text>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 p-4 bg-card border-t border-border">
        <Button className="bg-success" loading={submitting} onPress={submit}>
          Submit
        </Button>
      </View>
    </View>
  );
}
