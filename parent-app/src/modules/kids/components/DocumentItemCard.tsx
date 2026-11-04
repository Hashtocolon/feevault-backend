// ─────────────────────────────────────────────
//  Kids Component: DocumentItemCard
//  Downloadable card for Fee Receipts, Report Cards & Tuition Certificates
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../theme/colors';

interface DocumentItemCardProps {
  title: string;
  uploadedBy: string;
  date: string;
  size: string;
  icon: string;
  onDownload: () => void;
}

export const DocumentItemCard: React.FC<DocumentItemCardProps> = ({
  title,
  uploadedBy,
  date,
  size,
  icon,
  onDownload,
}) => {
  return (
    <View style={styles.docCard}>
      <View style={styles.docHeaderRow}>
        <View style={styles.docIconWrap}>
          <Text style={styles.docIcon}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docTitle}>{title}</Text>
          <Text style={styles.docUploaded}>{uploadedBy}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.docFooterRow}>
        <Text style={styles.docMeta}>
          {date} • {size} • PDF
        </Text>
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={onDownload}
          activeOpacity={0.7}>
          <Text style={styles.downloadBtnText}>Download PDF ⬇️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  docCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    elevation: 3,
    marginBottom: 12,
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  docIcon: {
    fontSize: 20,
  },
  docTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  docUploaded: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  docFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docMeta: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  downloadBtn: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  downloadBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.feeBlue,
  },
});

export default DocumentItemCard;

