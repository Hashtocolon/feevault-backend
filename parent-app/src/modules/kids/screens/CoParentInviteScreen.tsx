// ─────────────────────────────────────────────
//  FeeVault Parent App — Co-Parent Access Screen
//  Invite Spouse / Grandparent to Contribute (Save-Only Role)
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
import { CustomInput } from '../../../components/CustomInput';
import { CustomButton } from '../../../components/CustomButton';
import { PillBadge } from '../../../components/PillBadge';

type RelationType = 'Spouse' | 'Grandparent' | 'Guardian';

export const CoParentInviteScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<RelationType>('Spouse');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendInvite = () => {
    if (!name.trim() || !contact.trim()) {
      Alert.alert('Missing Details', 'Please provide full name and contact number/email.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Invitation Sent',
        `An invite link has been dispatched to ${name} (${contact}) with Save-Only access for your child's vault.`,
      );
      setName('');
      setContact('');
    }, 1000);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Background Gradient */}
      <LinearGradient
        colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <Header title="Co-Parent Access" showBack />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          <PillBadge label="FAMILY CONTRIBUTION VAULT" style={styles.badge} />

          <Text style={styles.title}>Invite Family Contributor</Text>
          <Text style={styles.subtitle}>
            Enable spouse or grandparents to deposit towards your child’s school fees.
          </Text>

          {/* Strict Permission Guard Notice */}
          <View style={styles.guardCard}>
            <Text style={styles.guardIcon}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.guardTitle}>Strict 'Save-Only' Permissions</Text>
              <Text style={styles.guardDesc}>
                Co-parents can only deposit money and view ledger statements. They cannot modify
                child profiles, change payout banks, or withdraw funds.
              </Text>
            </View>
          </View>

          {/* Invitation Form Card */}
          <View style={styles.card}>
            <CustomInput
              label="Full Name"
              placeholder="e.g. Rajesh Sharma"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.fieldLabel}>Relationship to Child</Text>
            <View style={styles.relationRow}>
              {(['Spouse', 'Grandparent', 'Guardian'] as RelationType[]).map((r) => {
                const active = relation === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.relChip, active && styles.relChipActive]}
                    onPress={() => setRelation(r)}>
                    <Text style={[styles.relChipText, active && styles.relChipTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <CustomInput
              label="Mobile Number or Email"
              placeholder="e.g. 9876543210 or email@domain.com"
              value={contact}
              onChangeText={setContact}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <CustomButton
              label={loading ? 'Sending Invite...' : 'Send Secure Invite Link →'}
              loading={loading}
              onPress={handleSendInvite}
              style={{ marginTop: 8 }}
            />
          </View>

          {/* Active Co-Parents Section */}
          <Text style={styles.sectionHeading}>Current Family Members</Text>
          <View style={styles.card}>
            <View style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>RS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>Rajesh Sharma</Text>
                <Text style={styles.memberMeta}>Spouse • Contributor Role</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>Active ✓</Text>
              </View>
            </View>
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
  guardCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  guardIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  guardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: 4,
  },
  guardDesc: {
    fontSize: 11,
    lineHeight: 16,
    color: '#1E3A8A',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    elevation: 3,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  relationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  relChip: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  relChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: COLORS.feeBlue,
  },
  relChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  relChipTextActive: {
    color: COLORS.feeBlue,
    fontWeight: '800',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#D9FAFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0757C9',
  },
  memberName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  memberMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#15803D',
  },
});

export default CoParentInviteScreen;

