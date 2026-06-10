import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSelector } from 'react-redux';
import { Home, Calendar, Laptop, Truck, User } from 'lucide-react-native';
import { selectSession } from '../store/authSlice';
import { resolveRoleKey } from '../config/categories';

// Third tab is role-aware:
//   PICKUP_PERSON → "Pickup" tile (Truck icon) opening the PickupAssign screen
//   TECHNICIAN / STAFF → "Tasks" tile (Laptop icon) opening the TaskAssign screen
// Both share the same `key: 'Tasks'` so TAB_FOR_ROUTE highlighting in
// TechnicianNavigator works uniformly across roles.
function tabsFor(roleKey) {
  const isPickup = roleKey === 'PICKUP_PERSON';
  return [
    { key: 'Home',       label: 'Home',       icon: Home,     route: 'Home' },
    { key: 'Attendance', label: 'Attendance', icon: Calendar, route: 'DailyAttendance' },
    isPickup
      ? { key: 'Tasks', label: 'Pickup', icon: Truck,  route: 'PickupAssign' }
      : { key: 'Tasks', label: 'Tasks',  icon: Laptop, route: 'TaskAssign' },
    { key: 'Account',    label: 'Account',    icon: User,     route: 'AccountTab' },
  ];
}

export default function BottomTabBar({ active = 'Home', navigation }) {
  const session = useSelector(selectSession);
  const roleKey = resolveRoleKey(session);
  const TABS = useMemo(() => tabsFor(roleKey), [roleKey]);
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
