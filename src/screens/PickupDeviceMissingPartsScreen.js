import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/rnr';

const PARTS = [
  { id: 'DISPLAY', name: 'Display', icon: 'phone-portrait-outline' },
  { id: 'BACK_PANEL', name: 'Back Panel', icon: 'layers-outline' },
  { id: 'SIM_TRAY', name: 'SIM Card Tray', icon: 'card-outline' },
  { id: 'BUTTONS', name: 'Buttons', icon: 'radio-button-on-outline' },
  { id: 'CHARGING_PORT', name: 'Charging Port', icon: 'flash-outline' },
  { id: 'CAMERA', name: 'Camera', icon: 'camera-outline' },
  { id: 'SPEAKER', name: 'Speaker', icon: 'volume-high-outline' },
];

export default function PickupDeviceMissingPartsScreen({ navigation, route }) {
  const params = route?.params || {};
  const [state, setState] = useState(() => {
    const prefill = Array.isArray(params.prefillMissingParts) ? params.prefillMissingParts : [];
    const seed = {};
    for (const p of prefill) {
      const key = p.partId || p.id;
      if (!key) continue;
      seed[key] = { missing: !!p.missing, damage: !!p.damage, detail: p.detail || '' };
    }
    return seed;
  });

  const setField = (id, key, value) =>
    setState((p) => ({ ...p, [id]: { ...(p[id] || {}), [key]: value } }));

  const { missingCount, damageCount, flaggedItems } = useMemo(() => {
    let m = 0, d = 0;
    const items = [];
    for (const p of PARTS) {
      const row = state[p.id] || {};
      if (row.missing) m += 1;
      if (row.damage) d += 1;
      if (row.missing || row.damage) {
        items.push({
          partId: p.id,
          partName: p.name,
          missing: !!row.missing,
          damage: !!row.damage,
          detail: row.detail || null,
        });
      }
    }
    return { missingCount: m, damageCount: d, flaggedItems: items };
  }, [state]);

  const onContinue = () => {
    navigation.navigate('PickupServiceBookingDevicesList', {
      ...params,
      missingParts: flaggedItems,
    });
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-4 pt-4 pb-32">
        <Text className="text-text-muted text-xs px-1 mb-2">Flag any part that's missing or damaged on this device.</Text>

        <View className="flex-row mb-4">
          <View className="flex-1 bg-danger/10 border border-danger/30 rounded-xl px-3 py-2 mr-2">
            <Text className="text-[10px] text-danger font-extrabold tracking-widest">MISSING</Text>
            <Text className="text-[18px] font-extrabold text-danger mt-0.5">{missingCount}</Text>
          </View>
          <View className="flex-1 bg-warning/10 border border-warning/30 rounded-xl px-3 py-2">
            <Text className="text-[10px] text-warning font-extrabold tracking-widest">DAMAGED</Text>
            <Text className="text-[18px] font-extrabold text-warning mt-0.5">{damageCount}</Text>
          </View>
        </View>

        {PARTS.map((p) => {
          const row = state[p.id] || {};
          const anyFlag = row.missing || row.damage;
          return (
            <View
              key={p.id}
              className={`bg-card border rounded-2xl p-3 mb-2.5 ${anyFlag ? 'border-primary/40' : 'border-border'}`}
            >
              <View className="flex-row items-center">
                <View className={`w-10 h-10 rounded-xl items-center justify-center mr-2.5 ${anyFlag ? 'bg-primary/15' : 'bg-primary/10'}`}>
                  <Ionicons name={p.icon} size={18} color="#00008B" />
                </View>
                <Text className="flex-1 font-extrabold text-text text-[14px]" numberOfLines={1}>{p.name}</Text>
                <Pressable
                  onPress={() => setField(p.id, 'missing', !row.missing)}
                  className={`mr-2 rounded-full px-3 py-1.5 ${row.missing ? 'bg-danger' : 'bg-background border border-border'}`}
                >
                  <Text className={`text-[11px] font-bold ${row.missing ? 'text-white' : 'text-text-muted'}`}>Missing</Text>
                </Pressable>
                <Pressable
                  onPress={() => setField(p.id, 'damage', !row.damage)}
                  className={`rounded-full px-3 py-1.5 ${row.damage ? 'bg-warning' : 'bg-background border border-border'}`}
                >
                  <Text className={`text-[11px] font-bold ${row.damage ? 'text-white' : 'text-text-muted'}`}>Damage</Text>
                </Pressable>
              </View>
              {anyFlag ? (
                <TextInput
                  placeholder="Add details (optional)"
                  placeholderTextColor="#94A3B8"
                  value={row.detail || ''}
                  onChangeText={(v) => setField(p.id, 'detail', v)}
                  className="mt-2.5 bg-background border border-border rounded-xl px-3 py-2 text-text text-[13px]"
                />
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 p-4 bg-card border-t border-border" style={{ shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}>
        <Button
          rightIcon={<Ionicons name="chevron-forward" size={20} color="#fff" />}
          onPress={onContinue}
        >
          Continue
        </Button>
      </View>
    </View>
  );
}
