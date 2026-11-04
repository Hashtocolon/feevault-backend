// ─────────────────────────────────────────────
//  FeeVault Parent App — File Exception Screen
//  School Change (TC), Closed School & Accidental Payment Exceptions
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS } from '../../../theme/colors';
import { ROUTES } from '../../../constants/routes';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import Header from '../../../components/Header';
import { CustomInput } from '../../../components/CustomInput';
import { CustomButton } from '../../../components/CustomButton';
import { PillBadge } from '../../../components/PillBadge';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type ExceptionReason = 'tc' | 'closed' | 'accidental';

export const FileExceptionScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const [reason, setReason] = useState<ExceptionReason>('tc');
  const [details, setDetails] = useState('');
  const [fileAttached, setFileAttached] = useState<string | null>(null);
  const [declared, setDeclared] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePickFile = () => {
    Alert.alert(
      'Attach Supporting Document',
      'Select PDF or Image proof from device.',
      [
        {
          text: 'Upload Transfer_Certificate.pdf',
          onPress: () => setFileAttached('Transfer_Certificate_Aarav.pdf (840 KB)'),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleSubmit = () => {
    if (!fileAttached) {
      Alert.alert('Document Required', 'Please attach the official document/proof for this exception.');
      return;
    }
    if (!declared) {
      Alert.alert('Declaration Required', 'Please confirm the legal declaration checkbox before submitting.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Exception Request Filed',
        'Request #EX-2026-041 has been submitted to the FeeVault Escrow Trustees. Verification SLA is 24-48 business hours.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate(ROUTES.HOME),
          },
        ],
      );
    }, 1200);
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
        <Header title="File Exception Request" showBack />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          <PillBadge label="ESCROW DISBURSEMENT EXCEPTION" style={styles.badge} />

          <Text style={styles.title}>File an Exception</Text>
          <Text style={styles.subtitle}>
            Locked savings may only be refunded to your bound bank account under verified exceptional conditions.
          </Text>

          {/* Reason Selection */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Select Reason for Exception</Text>

            <TouchableOpacity
              style={[styles.reasonOption, reason === 'tc' && styles.reasonOptionActive]}
              onPress={() => setReason('tc')}>
              <Text style={styles.reasonEmoji}>🏫</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.reasonTitle}>Child Changed School</Text>
                <Text style={styles.reasonSub}>
                  Requires official Transfer Certificate (TC) issued by the school.
                </Text>
              </View>
              <View style={[styles.radio, reason === 'tc' && styles.radioActive]} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reasonOption, reason === 'closed' && styles.reasonOptionActive]}
              onPress={() => setReason('closed')}>
              <Text style={styles.reasonEmoji}>🚪</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.reasonTitle}>School Operations Ceased</Text>
                <Text style={styles.reasonSub}>
                  Requires notification or closure confirmation letter from education board.
                </Text>
              </View>
              <View style={[styles.radio, reason === 'closed' && styles.radioActive]} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reasonOption, reason === 'accidental' && styles.reasonOptionActive]}
              onPress={() => setReason('accidental')}>
              <Text style={styles.reasonEmoji}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.reasonTitle}>Accidental Deposit (Within 48 Hours)</Text>
                <Text style={styles.reasonSub}>
                  Must provide bank transaction debit SMS / statement proof within 48 hours.
                </Text>
              </View>
              <View style={[styles.radio, reason === 'accidental' && styles.radioActive]} />
            </TouchableOpacity>
          </View>

          {/* Details & Document Upload */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Supporting Documentation</Text>

            <CustomInput
              label="Additional Notes / Justification"
              placeholder="Provide context for the exception review committee..."
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.fieldLabel}>Upload Official Proof Document (PDF/Image)</Text>
            <TouchableOpacity
              style={styles.uploadArea}
              onPress={handlePickFile}
              activeOpacity={0.8}>
              <Text style={styles.uploadIcon}>{fileAttached ? '✅' : '📎'}</Text>
              <Text style={styles.uploadTitle}>
                {fileAttached ? fileAttached : 'Tap to attach document'}
              </Text>
              <Text style={styles.uploadSub}>
                {fileAttached ? 'Tap to change file' : 'Max size 5 MB • PDF, PNG, JPG'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Legal Declaration Checkbox */}
          <TouchableOpacity
            style={styles.declarationRow}
            onPress={() => setDeclared(!declared)}
            activeOpacity={0.8}>
            <View style={[styles.checkbox, declared && styles.checkboxChecked]}>
              {declared && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
            <Text style={styles.declarationText}>
              I solemnly certify that the information and documents provided are genuine. I understand
              any approved refund will strictly be returned only to my verified bound refund bank account.
            </Text>
          </TouchableOpacity>

          {/* Submit CTA */}
          <CustomButton
            label={loading ? 'Filing Exception Request...' : 'Submit Exception for Review →'}
            loading={loading}
            onPress={handleSubmit}
            style={{ marginBottom: 12 }}
          />
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
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    elevation: 3,
    marginBottom: 18,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 12,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  reasonOptionActive: {
    borderColor: COLORS.feeBlue,
    backgroundColor: '#EFF6FF',
  },
  reasonEmoji: {
    fontSize: 22,
    marginRight: 12,
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  reasonSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginLeft: 8,
  },
  radioActive: {
    borderColor: COLORS.feeBlue,
    borderWidth: 5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 10,
    marginBottom: 8,
  },
  uploadArea: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#93C5FD',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  uploadTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.feeBlue,
  },
  uploadSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  declarationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.feeBlue,
    borderColor: COLORS.feeBlue,
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  declarationText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#475569',
  },
});

export default FileExceptionScreen;

