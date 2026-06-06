// Use your computer's IP when running on a physical device so the app can reach your backend.
// Run: set EXPO_PUBLIC_API_HOST=192.168.1.5  (then npx expo start)
// Or create .env with EXPO_PUBLIC_API_HOST=192.168.1.5
const host = process.env.EXPO_PUBLIC_API_HOST || 'localhost';

export default {
  expo: {
    name: 'Repair Shop Employee',
    slug: 'repair-shop-employee',
    version: '1.0.0',
    platforms: ['ios', 'android', 'web'],
    orientation: 'portrait',
    jsEngine: 'hermes',
    splash: { resizeMode: 'contain', backgroundColor: '#202124' },
    ios: { supportsTablet: true },
    android: { adaptiveIcon: { backgroundColor: '#202124' } },
    extra: {
      API_HOST: host,
    },
  },
};
