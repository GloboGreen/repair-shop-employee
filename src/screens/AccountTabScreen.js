import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { LogOut, User as UserIcon } from 'lucide-react-native';
import { selectSession } from '../store/authSlice';
import { useLogout } from '../auth/LogoutContext';
import { getRoleDisplayLabel } from '../config/categories';
import BottomTabBar from '../components/BottomTabBar';
import { confirm } from '../components/confirm';

export default function AccountTabScreen({ navigation }) {
  const session = useSelector(selectSession);
  const onLogout = useLogout();
  const displayName = session?.fullName || session?.email || 'Employee';
  const roleLabel = getRoleDisplayLabel(session);

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Log out?',
      message: 'You will need to sign in again to access your account.',
      confirmText: 'Log out',
      destructive: true,
    });
    if (ok) onLogout?.();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-4 pt-6">
        <View className="bg-card rounded-2xl border border-border p-5 items-center">
          <View className="h-16 w-16 rounded-full bg-primary items-center justify-center">
            <UserIcon size={28} color="#FFFFFF" />
          </View>
          <Text className="text-[18px] font-extrabold text-text mt-3">{displayName}</Text>
          <Text className="text-[12px] text-text-muted mt-0.5">{roleLabel}</Text>
          {session?.email ? (
            <Text className="text-[12px] text-text-muted mt-2">{session.email}</Text>
          ) : null}
          {session?.mobile ? (
            <Text className="text-[12px] text-text-muted mt-0.5">{session.mobile}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={handleLogout}
          className="mt-6 bg-card rounded-2xl border border-border p-4 flex-row items-center"
        >
          <View className="h-9 w-9 rounded-full bg-danger/10 items-center justify-center">
            <LogOut size={18} color="#EF4444" />
          </View>
          <Text className="text-[14px] text-danger font-bold ml-3">Log out</Text>
        </Pressable>
      </View>
      <BottomTabBar active="Account" navigation={navigation} />
    </SafeAreaView>
  );
}
