import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Home, Calendar, Laptop, User } from 'lucide-react-native';

const TABS = [
  { key: 'Home', label: 'Home', icon: Home, route: 'Home' },
  { key: 'Attendance', label: 'Attendance', icon: Calendar, route: 'AttendanceTab' },
  { key: 'Tasks', label: 'Tasks', icon: Laptop, route: 'TasksTab' },
  { key: 'Account', label: 'Account', icon: User, route: 'AccountTab' },
];

export default function BottomTabBar({ active = 'Home', navigation }) {
  return (
    <View
      className="absolute left-0 right-0 bottom-0 flex-row bg-primary"
      style={{ paddingBottom: 14, paddingTop: 10 }}
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => {
              if (isActive) return;
              navigation.navigate(t.route);
            }}
            className="flex-1 items-center justify-center"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Icon size={22} color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} strokeWidth={isActive ? 2.4 : 1.8} />
            <Text className="text-[11px] mt-1" style={{ color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.65)', fontWeight: isActive ? '700' : '500' }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
