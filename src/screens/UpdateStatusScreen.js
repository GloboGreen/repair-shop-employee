import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ticketApi } from '../api/client';

const STATUS_OPTIONS = ['CREATED', 'IN_DIAGNOSIS', 'QUOTED', 'APPROVED', 'IN_REPAIR', 'READY', 'DELIVERED', 'CANCELLED'];

export default function UpdateStatusScreen({ route, navigation }) {
  const { ticketId } = route.params || {};
  const [submitting, setSubmitting] = useState(null);

  const onSelect = async (status) => {
    if (!ticketId) return;
    setSubmitting(status);
    try {
      await ticketApi.patch(`/tickets/${ticketId}/status`, { query: { status } });
      Alert.alert('Done', 'Status updated', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update status');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Select new status</Text>
      {STATUS_OPTIONS.map((status) => (
        <TouchableOpacity
          key={status}
          style={styles.option}
          onPress={() => onSelect(status)}
          disabled={submitting != null}
        >
          <Text style={styles.optionText}>{status}</Text>
          {submitting === status ? <ActivityIndicator size="small" color="#22C55E" /> : null}
        </TouchableOpacity>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#202124', padding: 16 },
  title: { fontSize: 18, fontWeight: '600', color: '#F8FAFC', marginBottom: 16 },
  option: { backgroundColor: '#282A2D', borderRadius: 8, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#3C4043', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionText: { fontSize: 16, color: '#F8FAFC' },
});
