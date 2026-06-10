import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const DOCS = [
  {
    key: 'aadhar',
    icon: 'id-card-outline',
    title: 'Aadhar Card',
    desc: 'Required for identity verification.',
    tint: '#EFF6FF',
    iconColor: '#2563EB',
  },
  {
    key: 'pan',
    icon: 'card-outline',
    title: 'PAN Card',
    desc: 'Required for tax verification.',
    tint: '#FDF4FF',
    iconColor: '#A21CAF',
  },
];

export default function TechnicianKycIntroScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="shield-checkmark" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>Let's begin your KYC verification</Text>
          <Text style={styles.heroSubtitle}>
            Have these documents ready before you start. The whole process takes about 2 minutes.
          </Text>
        </View>

        <Text style={styles.checklistLabel}>Documents you'll need</Text>

        <View style={styles.cardGrid}>
          {DOCS.map((doc, idx) => (
            <View key={doc.key} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardStep}>
                  <Text style={styles.cardStepText}>{idx + 1}</Text>
                </View>
                <View style={[styles.cardIconWrap, { backgroundColor: doc.tint }]}>
                  <Ionicons name={doc.icon} size={20} color={doc.iconColor} />
                </View>
              </View>
              <Text style={styles.cardTitle}>{doc.title}</Text>
              <Text style={styles.cardDesc}>{doc.desc}</Text>
            </View>
          ))}
        </View>

        <View style={styles.secureNote}>
          <Ionicons name="lock-closed" size={13} color="#00008B" />
          <Text style={styles.secureNoteText}>
            Your documents are encrypted and used only for verification.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('TechnicianKycUpload')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F1FB' },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 32 },

  hero: {
    backgroundColor: '#00008B',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'flex-start',
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  heroSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 17 },

  checklistLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginTop: 14,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardStep: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStepText: { fontSize: 10, fontWeight: '800', color: '#00008B' },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#111827', marginTop: 10 },
  cardDesc: { fontSize: 11, color: '#6B7280', marginTop: 3, lineHeight: 15 },

  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 6,
  },
  secureNoteText: { flex: 1, fontSize: 11, color: '#00008B', fontWeight: '600' },

  button: {
    marginTop: 14,
    backgroundColor: '#16A34A',
    borderRadius: 999,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
});
