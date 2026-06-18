import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  listMyKycDocuments,
  deleteMyKycDocument,
} from '../api/technicianKyc';
import { confirm, notify } from '../components/confirm';

const ORDER = ['aadharFront', 'aadharBack', 'pan'];
const TITLES = {
  aadharFront: 'Aadhar Card Front',
  aadharBack:  'Aadhar Card Back',
  pan:         'PAN Card',
};

function isPdf(url) {
  return typeof url === 'string' && url.toLowerCase().includes('.pdf');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TechnicianKycViewScreen({ route, navigation }) {
  const fromSubmit = !!route?.params?.fromSubmit;
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingType, setDeletingType] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const list = await listMyKycDocuments();
      setDocs(Array.isArray(list) ? list : []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const byType = Object.fromEntries(docs.map((d) => [d.docType, d]));
  const orderedDocs = ORDER.map((key) => byType[key]).filter(Boolean);

  const overallStatus = (() => {
    if (orderedDocs.length === 0) return 'NONE';
    if (orderedDocs.some((d) => d.status === 'REJECTED')) return 'REJECTED';
    if (orderedDocs.every((d) => d.status === 'APPROVED')) return 'APPROVED';
    return 'PENDING_REVIEW';
  })();

  const onEdit = () => {
    navigation.navigate('TechnicianKycUpload', { existing: byType });
  };

  const onDelete = async (doc) => {
    const ok = await confirm({
      title: 'Remove document?',
      message: `Remove ${doc.title || TITLES[doc.docType] || doc.docType} from your KYC submission?`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    setDeletingType(doc.docType);
    try {
      await deleteMyKycDocument(doc.docType);
      await load(true);
    } catch (e) {
      notify('Failed', e?.message || 'Please try again.', { preset: 'error', haptic: 'error' });
    } finally {
      setDeletingType(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {/* Status hero */}
        <View style={[
          styles.statusCard,
          overallStatus === 'APPROVED' && styles.statusApproved,
          overallStatus === 'REJECTED' && styles.statusRejected,
          overallStatus === 'PENDING_REVIEW' && styles.statusPending,
          overallStatus === 'NONE' && styles.statusNone,
        ]}>
          <View style={styles.statusIconWrap}>
            <Ionicons
              name={
                overallStatus === 'APPROVED' ? 'shield-checkmark'
                  : overallStatus === 'REJECTED' ? 'close-circle'
                    : overallStatus === 'NONE' ? 'document-text-outline'
                      : 'time'
              }
              size={22}
              color="#FFFFFF"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              {overallStatus === 'APPROVED' && 'KYC Approved'}
              {overallStatus === 'REJECTED' && 'KYC Rejected'}
              {overallStatus === 'PENDING_REVIEW' && 'Under Review'}
              {overallStatus === 'NONE' && 'No documents yet'}
            </Text>
            <Text style={styles.statusSub}>
              {fromSubmit && overallStatus === 'PENDING_REVIEW'
                ? 'Thank you! Your documents are now being reviewed by admin.'
                : overallStatus === 'APPROVED' ? 'All documents have been verified.'
                  : overallStatus === 'REJECTED' ? 'One or more documents need attention. Tap Edit to fix.'
                    : overallStatus === 'NONE' ? 'Upload your KYC documents to start verification.'
                      : `${orderedDocs.length} document${orderedDocs.length === 1 ? '' : 's'} awaiting admin review.`}
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#00008B" style={{ marginVertical: 40 }} />
        ) : orderedDocs.length === 0 ? (
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => navigation.navigate('TechnicianKycUpload')}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
            <Text style={styles.uploadBtnText}>Upload KYC Documents</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.actionRow}>
              <Text style={styles.sectionLabel}>Uploaded Documents</Text>
              <TouchableOpacity style={styles.editBtn} onPress={onEdit} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={13} color="#00008B" />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.grid}>
              {orderedDocs.map((doc) => {
                const pillStyle =
                  doc.status === 'APPROVED' ? styles.pillApproved
                    : doc.status === 'REJECTED' ? styles.pillRejected
                      : styles.pillPending;
                const pillLabel =
                  doc.status === 'APPROVED' ? 'Approved'
                    : doc.status === 'REJECTED' ? 'Rejected'
                      : 'Pending';
                return (
                  <View key={doc.id || doc.docType} style={styles.cardOuter}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderIcon}>
                        <Ionicons name="person-circle-outline" size={16} color="#374151" />
                      </View>
                      <Text style={styles.cardHeaderTitle} numberOfLines={1}>
                        {doc.title || TITLES[doc.docType] || doc.docType}
                      </Text>
                      {doc.required && <Text style={styles.requiredStar}>*</Text>}
                    </View>

                    <View style={styles.preview}>
                      {isPdf(doc.url) ? (
                        <View style={styles.pdfTile}>
                          <View style={styles.pdfBadge}><Text style={styles.pdfBadgeText}>PDF</Text></View>
                          <Text style={styles.pdfName} numberOfLines={2}>
                            {(doc.title || doc.docType).toLowerCase().replace(/\s+/g, '-')}.pdf
                          </Text>
                        </View>
                      ) : (
                        <Image source={{ uri: doc.url }} style={styles.previewImg} />
                      )}
                    </View>

                    <View style={styles.cardFooter}>
                      <View style={[styles.pill, pillStyle]}>
                        <Text style={styles.pillText}>{pillLabel}</Text>
                      </View>
                      <Text style={styles.uploadedDate}>{fmtDate(doc.updatedAt || doc.createdAt)}</Text>
                      <TouchableOpacity
                        onPress={() => onDelete(doc)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        disabled={deletingType === doc.docType}
                      >
                        {deletingType === doc.docType ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                        )}
                      </TouchableOpacity>
                    </View>
                    {doc.status === 'REJECTED' && doc.rejectReason && (
                      <Text style={styles.rejectReason}>{doc.rejectReason}</Text>
                    )}
                  </View>
                );
              })}
            </View>

            <TouchableOpacity style={styles.editLargeBtn} onPress={onEdit} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={15} color="#FFFFFF" />
              <Text style={styles.editLargeBtnText}>Edit Documents</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F1FB' },
  content: { padding: 14, paddingBottom: 32 },

  statusCard: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  statusApproved: { backgroundColor: '#22C55E' },
  statusRejected: { backgroundColor: '#EF4444' },
  statusPending:  { backgroundColor: '#00008B' },
  statusNone:     { backgroundColor: '#6B7280' },
  statusIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  statusSub: { fontSize: 11, color: 'rgba(255,255,255,0.92)', marginTop: 2, lineHeight: 15 },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 0.3, textTransform: 'uppercase' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EEF2FF', borderRadius: 999 },
  editBtnText: { fontSize: 11, color: '#00008B', fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  cardOuter: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 8, marginBottom: 6 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  cardHeaderIcon: { width: 18, alignItems: 'center' },
  cardHeaderTitle: { flex: 1, fontSize: 11, fontWeight: '700', color: '#111827' },
  requiredStar: { color: '#DC2626', fontWeight: '800', fontSize: 12 },

  preview: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#F9FAFB', minHeight: 110 },
  previewImg: { width: '100%', height: 110, resizeMode: 'cover' },
  pdfTile: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8, minHeight: 110 },
  pdfBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: '#EF4444' },
  pdfBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  pdfName: { flex: 1, fontSize: 11, color: '#374151', fontWeight: '600' },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pillApproved: { backgroundColor: '#22C55E' },
  pillRejected: { backgroundColor: '#EF4444' },
  pillPending:  { backgroundColor: '#F59E0B' },
  pillText: { fontSize: 9, color: '#FFFFFF', fontWeight: '800' },
  uploadedDate: { flex: 1, fontSize: 9, color: '#9CA3AF', fontWeight: '600' },

  rejectReason: { fontSize: 10, color: '#DC2626', marginTop: 4, fontStyle: 'italic' },

  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00008B',
    borderRadius: 999,
    paddingVertical: 12,
    marginTop: 14,
  },
  uploadBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  editLargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00008B',
    borderRadius: 999,
    paddingVertical: 12,
    marginTop: 14,
  },
  editLargeBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
});
