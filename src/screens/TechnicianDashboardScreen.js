import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TechnicianDashboardScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Technician Dashboard</Text>
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('TaskAssign')}>
        <Text style={styles.cardTitle}>My Assigned Tickets</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#202124', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#F8FAFC', marginBottom: 16 },
  card: { backgroundColor: '#282A2D', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#3C4043' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#F8FAFC' },
});
