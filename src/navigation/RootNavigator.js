import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useDispatch } from 'react-redux';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getSession, clearSession, setAuthExpiredHandler } from '../auth/session';
import { logout } from '../api/auth';
import { setSession, clearSession as clearAuth } from '../store/authSlice';
import LoginScreen from '../screens/LoginScreen';
import TechnicianNavigator from './TechnicianNavigator';

const Stack = createNativeStackNavigator();

// Employee app: customer accounts cannot use it. Any other authenticated
// shop role (TECHNICIAN, SHOP_OWNER, etc.) lands on the technician stack
// for now — owner-only screens can be layered in later.
function isCustomerOnly(session) {
  const roles = session?.roles || [];
  if (!roles.length) return false;
  return roles.every((r) => r === 'CUSTOMER');
}

export default function RootNavigator() {
  const dispatch = useDispatch();
  const [session, setSessionState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then((s) => {
      setSessionState(s);
      dispatch(setSession(s));
      setLoading(false);
    });
  }, [dispatch]);

  useEffect(() => {
    setAuthExpiredHandler(() => {
      setSessionState(null);
      dispatch(clearAuth());
    });
    return () => setAuthExpiredHandler(null);
  }, [dispatch]);

  const handleLogin = (newSession) => {
    setSessionState(newSession);
    dispatch(setSession(newSession));
  };
  const handleLogout = async () => {
    try { await logout(); } catch (_) {}
    await clearSession();
    setSessionState(null);
    dispatch(clearAuth());
  };

  if (loading) return null;

  if (!session?.accessToken || isCustomerOnly(session)) {
    if (isCustomerOnly(session)) {
      // Clear the rejected customer session so the next login isn't blocked.
      clearSession();
    }
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login">
          {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  return <TechnicianNavigator session={session} onLogout={handleLogout} />;
}
