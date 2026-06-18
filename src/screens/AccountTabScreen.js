import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronRight,
  User as UserIcon,
  Lock,
  Briefcase,
  CreditCard,
  FileText,
  ShieldCheck,
  HelpCircle,
  LogOut,
  Pencil,
} from 'lucide-react-native';
import { selectSession } from '../store/authSlice';
import { useLogout } from '../auth/LogoutContext';
import { getRoleDisplayLabel } from '../config/categories';
import { confirm, notify } from '../components/confirm';
import { listMyKycDocuments } from '../api/technicianKyc';

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

export default function AccountTabScreen({ navigation }) {
  const session = useSelector(selectSession);
  const onLogout = useLogout();
  const displayName = session?.fullName || session?.email || 'Employee';
  const roleLabel = getRoleDisplayLabel(session);
  const employeeId = employeeIdFromSession(session);
  const openProfile = () => navigation.navigate('TechnicianProfile');

  // Route KYC Documents to View (already uploaded) vs Intro (first time)
  // without a manual reload. null = unknown until the first list call lands.
  const [hasKycDocs, setHasKycDocs] = useState(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const list = await listMyKycDocuments();
          if (!cancelled) setHasKycDocs(Array.isArray(list) && list.length > 0);
        } catch {
          if (!cancelled) setHasKycDocs(false);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );
  const openKyc = () =>
    navigation.navigate(hasKycDocs ? 'TechnicianKycView' : 'TechnicianKycIntro');

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Log out?',
      message: 'You will need to sign in again to access your account.',
      confirmText: 'Log out',
      destructive: true,
    });
    if (ok) onLogout?.();
  };

  const comingSoon = (label) => notify(label, 'This section is coming soon.');

  // Sections give the long list a visual rhythm — the user scans grouped
  // cards faster than a flat list of nine identical rows.
  const sections = [
    {
      title: 'Account',
      items: [
        { key: 'profile',  label: 'Profile',         icon: UserIcon, tint: '#DBEAFE', fg: '#1D4ED8', onPress: openProfile },
        { key: 'password', label: 'Change Password', icon: Lock,     tint: '#FEF3C7', fg: '#B45309', onPress: () => comingSoon('Change Password') },
      ],
    },
    {
      title: 'Work',
      items: [
        { key: 'work', label: 'Work Experience', icon: Briefcase,  tint: '#EDE9FE', fg: '#6D28D9', onPress: () => navigation.navigate('WorkExperience') },
        { key: 'kyc',  label: 'KYC Documents',   icon: CreditCard, tint: '#DCFCE7', fg: '#15803D', onPress: openKyc },
      ],
    },
    {
      title: 'Help & Legal',
      items: [
        { key: 'terms',   label: 'Terms & Conditions', icon: FileText,    tint: '#FFE4E6', fg: '#BE123C', onPress: () => comingSoon('Terms & Conditions') },
        { key: 'privacy', label: 'Privacy Policy',     icon: ShieldCheck, tint: '#CFFAFE', fg: '#0E7490', onPress: () => comingSoon('Privacy Policy') },
        { key: 'help',    label: 'Help Center',        icon: HelpCircle,  tint: '#FFEDD5', fg: '#C2410C', onPress: () => comingSoon('Help Center') },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* In-screen header — this tab has no native header so the title
          would otherwise be missing. A small accent bar under the title
          gives the screen a stronger visual entry point. */}
      <View className="px-4 pt-3 pb-3 bg-background border-b border-border">
        <Text className="text-[18px] font-extrabold text-text text-center">My Account</Text>
        <View className="h-[3px] w-12 rounded-full bg-primary self-center mt-1.5" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Profile hero — colored card with edit affordance leading into the
            Profile screen. Tappable as a whole so the avatar/name/edit are
            all valid hit targets for the same destination. */}
        <Pressable
          onPress={openProfile}
          android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
          className="mx-4 mt-4 bg-primary rounded-2xl p-4"
          style={{
            shadowColor: '#00008B',
            shadowOpacity: 0.25,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 5,
          }}
        >
          <View className="flex-row items-center">
            <View
              className="h-16 w-16 rounded-full items-center justify-center"
              style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)' }}
            >
              {session?.photoUrl ? (
                <Image source={{ uri: session.photoUrl }} className="h-[60px] w-[60px] rounded-full" />
              ) : (
                <View
                  className="h-[60px] w-[60px] rounded-full items-center justify-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
                >
                  <Text className="text-white font-extrabold text-[18px]">
                    {initialsFromName(displayName)}
                  </Text>
                </View>
              )}
            </View>
            <View className="flex-1 ml-3 pr-2">
              <Text className="text-[16px] font-extrabold text-white" numberOfLines={1}>
                {displayName}
              </Text>
              <View className="flex-row items-center mt-1">
                <View
                  className="self-start rounded-full px-2 py-[3px] flex-row items-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
                >
                  <View className="h-[6px] w-[6px] rounded-full mr-1.5" style={{ backgroundColor: '#4ADE80' }} />
                  <Text className="text-[10px] font-extrabold tracking-wider text-white">
                    {roleLabel?.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
            <View
              className="h-9 w-9 rounded-full items-center justify-center"
              style={{ backgroundColor: '#FFFFFF' }}
            >
              <Pencil size={15} color="#00008B" strokeWidth={2.4} />
            </View>
          </View>

          {/* ID chip on its own row so it never collides with the name/badge */}
          <View
            className="flex-row items-center mt-3 self-start rounded-lg px-2.5 py-1"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
          >
            <Text className="text-[10px] font-bold tracking-wider text-white/70 mr-1.5">ID</Text>
            <Text className="text-[12px] font-extrabold text-white tracking-wider">{employeeId}</Text>
          </View>
        </Pressable>

        {/* Grouped sections */}
        {sections.map((sec) => (
          <View key={sec.title} className="mt-5">
            <Text className="text-[11px] font-extrabold text-text-muted tracking-wider px-4 mb-2">
              {sec.title.toUpperCase()}
            </Text>
            <View
              className="mx-4 bg-card rounded-2xl border border-border overflow-hidden"
              style={{ shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}
            >
              {sec.items.map((it, idx) => {
                const Icon = it.icon;
                const isLast = idx === sec.items.length - 1;
                return (
                  <Pressable
                    key={it.key}
                    onPress={it.onPress}
                    android_ripple={{ color: '#E2E8F0' }}
                    className="flex-row items-center px-4 py-3.5"
                    style={!isLast ? { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' } : null}
                  >
                    <View
                      className="h-9 w-9 rounded-xl items-center justify-center mr-3"
                      style={{ backgroundColor: it.tint }}
                    >
                      <Icon size={18} color={it.fg} strokeWidth={2.2} />
                    </View>
                    <Text className="flex-1 text-[14px] text-text font-bold">{it.label}</Text>
                    <ChevronRight size={18} color="#94A3B8" />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {/* Log out — full-width red button so the destructive action is
            visually distinct from the menu rows above it. */}
        <Pressable
          onPress={handleLogout}
          android_ripple={{ color: '#FECACA' }}
          className="mx-4 mt-6 rounded-2xl bg-card border flex-row items-center justify-center py-3.5"
          style={{
            borderColor: '#FECACA',
            shadowColor: '#DC2626',
            shadowOpacity: 0.1,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
          }}
        >
          <LogOut size={17} color="#DC2626" strokeWidth={2.4} />
          <Text className="ml-2 text-[14px] font-extrabold" style={{ color: '#DC2626' }}>Log out</Text>
        </Pressable>

        <Text className="text-[10px] text-text-muted text-center mt-4 font-semibold">
          GG Fix Employee · v1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
