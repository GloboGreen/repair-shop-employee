import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Wrench, Mail, Lock, Store, ShieldCheck, KeyRound } from 'lucide-react-native';
import { login } from '../api/auth';
import { AUTH_BASE } from '../api/config';
import { Button, Input, Label } from '../components/rnr';

export default function LoginScreen({ onLogin }) {
  const [authMethod, setAuthMethod] = useState('PASSWORD'); // PASSWORD | OTP
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [shopSlug, setShopSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const usingOtp = authMethod === 'OTP';

  const handleSubmit = async () => {
    setError(null);
    try {
      setLoading(true);
      if (!email.trim()) { setError('Email or mobile is required'); return; }
      const credential = usingOtp ? { otp: otp.trim() } : { password };
      if (usingOtp && !otp.trim()) { setError('OTP is required'); return; }
      if (!usingOtp && !password.trim()) { setError('Password is required'); return; }
      const data = await login(email.trim(), { ...credential, shopSlug: shopSlug.trim() || undefined });
      onLogin(data);
    } catch (e) {
      const msg = e?.message || 'Authentication failed';
      const isLocalhost = /localhost|127\.0\.0\.1/.test(String(msg));
      if (isLocalhost) {
        const urlMatch = String(msg).match(/URL:\s*(\S+)/i);
        const triedUrl = urlMatch ? urlMatch[1] : '(unknown)';
        setError(
          `Can't reach server (trying localhost). Tried: ${triedUrl}. ` +
            `Current AUTH_BASE: ${AUTH_BASE}. Restart Expo with EXPO_PUBLIC_API_HOST=YOUR_PC_IP.`,
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={['#00008B', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: Platform.OS === 'ios' ? 70 : 56, paddingBottom: 56, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          <View className="flex-row items-center mb-6">
            <View className="h-12 w-12 rounded-2xl bg-white/15 items-center justify-center mr-3">
              <Wrench size={24} color="#fff" />
            </View>
            <View>
              <Text className="text-white text-2xl font-extrabold">Globo Green</Text>
              <Text className="text-white/80 text-[12px] mt-0.5">Employee app · Technician · Pickup Person · Staff</Text>
            </View>
          </View>
          <Text className="text-white text-[26px] font-extrabold leading-8">Welcome back!</Text>
          <Text className="text-white/80 text-[13px] mt-2 leading-5">
            Sign in to your Technician, Pickup Person, or Staff account to view assigned tickets and update repair status.
          </Text>
        </LinearGradient>

        <View className="-mt-8 mx-4 bg-card rounded-3xl border border-border p-5"
              style={{ shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
          <View className="mb-3">
            <Label>Email or Mobile</Label>
            <View className="flex-row items-center bg-background rounded-xl border border-border px-3">
              <Mail size={16} color="#64748B" />
              <Input
                placeholder="you@example.com or 9876543210"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                className="flex-1 bg-transparent border-0 ml-2"
              />
            </View>
          </View>

          <AuthMethodToggle value={authMethod} onChange={setAuthMethod} />

          <View className="mb-3">
            <Label>{usingOtp ? 'OTP' : 'Password'}</Label>
            <View className="flex-row items-center bg-background rounded-xl border border-border px-3">
              {usingOtp ? <KeyRound size={16} color="#64748B" /> : <Lock size={16} color="#64748B" />}
              {usingOtp ? (
                <Input
                  placeholder="6-digit OTP"
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  className="flex-1 bg-transparent border-0 ml-2"
                />
              ) : (
                <Input
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  className="flex-1 bg-transparent border-0 ml-2"
                />
              )}
            </View>
            {usingOtp ? (
              <Text className="text-[10.5px] text-text-muted mt-1.5 ml-1">Default dev OTP for shop staff: 123456.</Text>
            ) : null}
          </View>

          <View className="mb-1">
            <Label>Shop slug (optional)</Label>
            <View className="flex-row items-center bg-background rounded-xl border border-border px-3">
              <Store size={16} color="#64748B" />
              <Input
                placeholder="my-shop"
                value={shopSlug}
                onChangeText={setShopSlug}
                autoCapitalize="none"
                className="flex-1 bg-transparent border-0 ml-2"
              />
            </View>
          </View>

          {error ? (
            <View className="bg-danger/10 border border-danger/30 rounded-xl px-3 py-2 mt-3">
              <Text className="text-[12px] text-danger leading-4">{error}</Text>
            </View>
          ) : null}

          <Button
            onPress={handleSubmit}
            loading={loading}
            className="mt-4"
            fullWidth
          >
            Log In
          </Button>
        </View>

        <View className="flex-row items-center justify-center px-6 py-6 mt-2">
          <ShieldCheck size={14} color="#64748B" />
          <Text className="text-[11px] text-text-muted ml-1.5 text-center">
            Technician · Pickup Person · Staff only. Customers should use the Globo Green customer app.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AuthMethodToggle({ value, onChange }) {
  const isPwd = value === 'PASSWORD';
  return (
    <View className="flex-row bg-background rounded-xl p-1 mb-3 border border-border">
      <Pressable
        onPress={() => onChange('PASSWORD')}
        className={`flex-1 flex-row items-center justify-center py-2 rounded-lg ${isPwd ? 'bg-card' : ''}`}
        style={isPwd ? { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } } : null}
      >
        <Lock size={13} color={isPwd ? '#00008B' : '#64748B'} />
        <Text className={`ml-1.5 text-[12px] font-bold ${isPwd ? 'text-primary' : 'text-text-muted'}`}>Password</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('OTP')}
        className={`flex-1 flex-row items-center justify-center py-2 rounded-lg ${!isPwd ? 'bg-card' : ''}`}
        style={!isPwd ? { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } } : null}
      >
        <KeyRound size={13} color={!isPwd ? '#00008B' : '#64748B'} />
        <Text className={`ml-1.5 text-[12px] font-bold ${!isPwd ? 'text-primary' : 'text-text-muted'}`}>OTP</Text>
      </Pressable>
    </View>
  );
}
