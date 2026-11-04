// ─────────────────────────────────────────────
//  FeeVault Parent App — School Documents Screen
//  Modular Architecture using DocumentItemCard
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../../theme/colors';
import Header from '../../../components/Header';
import { PillBadge } from '../../../components/PillBadge';

// Modular Sub-Component
import { DocumentItemCard } from '../components/DocumentItemCard';

type CategoryKey = 'all' | 'receipts' | 'reports' | 'certs';

interface SchoolDoc {
  id: string;
  category: 'receipts' | 'reports' | 'certs';
  title: string;
  uploadedBy: string;
  date: string;
  size: string;
  icon: string;
}

const DOCUMENTS: SchoolDoc[] = [
  {
    id: '1',
    category: 'receipts',
    title: 'Quarter 2 Official Fee Receipt #FV10284',
    uploadedBy: 'FeeVault Admin for Green Valley School',
    date: '28 Oct 2026',
    size: '240 KB',
    icon: '🧾',
  },
  {
    id: '2',
    category: 'receipts',
    title: 'Quarter 1 Official Fee Receipt #FV10012',
    uploadedBy: 'FeeVault Admin for Green Valley School',
    date: '15 Jul 2026',
    size: '235 KB',
    icon: '🧾',
  },
  {
    id: '3',
    category: 'reports',
    title: 'Mid-Term Academic Progress Report 2026-27',
    uploadedBy: 'Green Valley School Administration',
    date: '20 Sep 2026',
    size: '1.2 MB',
    icon: '📑',
  },
  {
    id: '4',
    category: 'certs',
    title: 'Tuition Fee Bona Fide Certificate (Income Tax)',
    uploadedBy: 'FeeVault Verification Desk',
    date: '02 Aug 2026',
    size: '410 KB',
    icon: '📜',
  },
];

export const SchoolDocumentsScreen: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');

  const filteredDocs =
    activeCategory === 'all'
      ? DOCUMENTS
      : DOCUMENTS.filter((d) => d.category === activeCategory);

  const handleDownload = (docTitle: string) => {
    Alert.alert('Download Started', `${docTitle} is downloading to your device.`);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Background Gradient */}
      <LinearGradient
        colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <Header title="School Documents" showBack />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          <PillBadge label="OFFICIAL SCHOOL RECORDS" style={styles.badge} />

          <Text style={styles.title}>Child Document Vault</Text>
          <Text style={styles.subtitle}>
            Verified fee receipts, report cards, and certificates uploaded directly by school and admin.
          </Text>

          {/* Category Tabs */}
          <View style={styles.categoryRow}>
            <TouchableOpacity
              style={[styles.catChip, activeCategory === 'all' && styles.catChipActive]}
              onPress={() => setActiveCategory('all')}>
              <Text style={[styles.catChipText, activeCategory === 'all' && styles.catChipTextActive]}>
                All Docs
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.catChip, activeCategory === 'receipts' && styles.catChipActive]}
              onPress={() => setActiveCategory('receipts')}>
              <Text style={[styles.catChipText, activeCategory === 'receipts' && styles.catChipTextActive]}>
                Fee Receipts
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.catChip, activeCategory === 'reports' && styles.catChipActive]}
              onPress={() => setActiveCategory('reports')}>
              <Text style={[styles.catChipText, activeCategory === 'reports' && styles.catChipTextActive]}>
                Report Cards
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.catChip, activeCategory === 'certs' && styles.catChipActive]}
              onPress={() => setActiveCategory('certs')}>
              <Text style={[styles.catChipText, activeCategory === 'certs' && styles.catChipTextActive]}>
                Certificates
              </Text>
            </TouchableOpacity>
          </View>

          {/* Document Cards via Modular Component */}
          <View style={styles.docsList}>
            {filteredDocs.map((doc) => (
              <DocumentItemCard
                key={doc.id}
                title={doc.title}
                uploadedBy={doc.uploadedBy}
                date={doc.date}
                size={doc.size}
                icon={doc.icon}
                onDownload={() => handleDownload(doc.title)}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EEF9FF',
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  badge: {
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12.5,
    color: COLORS.textMid,
    lineHeight: 18,
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  catChip: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: COLORS.feeBlue,
  },
  catChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  catChipTextActive: {
    color: COLORS.feeBlue,
    fontWeight: '800',
  },
  docsList: {
    gap: 12,
  },
});

export default SchoolDocumentsScreen;
