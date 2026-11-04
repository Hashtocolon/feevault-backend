// ─────────────────────────────────────────────
//  FeeVault Parent App — Help Desk & Ticket Support
//  FAQs, In-App Ticket Desk, Grievance Officer & Exception Link
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
import { PillBadge } from '../../../components/PillBadge';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const FAQS = [
  {
    q: 'How does FeeVault escrow safeguard my deposits?',
    a: 'Deposits are placed into a SEBI/RBI regulated escrow account held in trust. Neither FeeVault nor third parties can divert funds. Transfers occur only to verified school bank accounts.',
  },
  {
    q: 'When does the school receive the fee payout?',
    a: 'Funds are transferred automatically on or before your school fee due date as scheduled in your child vault.',
  },
  {
    q: 'What if I need to withdraw due to school transfer?',
    a: 'File an Exception Request along with the Transfer Certificate (TC) issued by the school for verification and refund to your bound bank account.',
  },
];

export const HelpDeskScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleRaiseTicket = () => {
    Alert.alert(
      'Support Ticket Raised',
      'Ticket #TK-2026-902 has been generated. Our escrow support representative will contact you within 1 hour.',
    );
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
        <Header title="Help & Support Desk" showBack />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          <PillBadge label="24x7 PARENT ASSISTANCE" style={styles.badge} />

          <Text style={styles.title}>How can we assist you?</Text>
          <Text style={styles.subtitle}>
            Resolution desk, legal grievances, FAQs, and emergency exception requests.
          </Text>

          {/* Exception Request Banner */}
          <TouchableOpacity
            style={styles.exceptionCard}
            onPress={() => navigation.navigate(ROUTES.FILE_EXCEPTION)}
            activeOpacity={0.85}>
            <View style={styles.exceptionIconWrap}>
              <Text style={styles.exceptionIcon}>🚨</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exceptionTitle}>File an Exception Request</Text>
              <Text style={styles.exceptionSub}>
                Child changed school (TC), school closed, or accidental payment (48-hr window).
              </Text>
            </View>
            <Text style={styles.exceptionArrow}>➔</Text>
          </TouchableOpacity>

          {/* Ticket Desk Card */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardHeader}>In-App Ticket Desk</Text>
              <TouchableOpacity onPress={handleRaiseTicket}>
                <Text style={styles.raiseLink}>＋ New Ticket</Text>
              </TouchableOpacity>
            </View>

            {/* Active Ticket */}
            <View style={styles.ticketItem}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketId}>#TK-2026-891</Text>
                <View style={styles.ticketPill}>
                  <Text style={styles.ticketPillText}>Under Review ⏳</Text>
                </View>
              </View>
              <Text style={styles.ticketSubject}>Reconciliation check on Oct 28 fee payment</Text>
              <Text style={styles.ticketTime}>Last reply 2 hours ago from Escrow Support Desk</Text>
            </View>
          </View>

          {/* FAQs Accordion */}
          <Text style={styles.sectionHeading}>Frequently Asked Questions</Text>
          <View style={styles.card}>
            {FAQS.map((item, index) => {
              const isExpanded = expandedFaq === index;
              return (
                <View
                  key={index}
                  style={[styles.faqItem, index === FAQS.length - 1 && { borderBottomWidth: 0 }]}>
                  <TouchableOpacity
                    style={styles.faqQuestionRow}
                    onPress={() => toggleFaq(index)}
                    activeOpacity={0.7}>
                    <Text style={styles.faqQuestion}>{item.q}</Text>
                    <Text style={styles.faqToggleIcon}>{isExpanded ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <Text style={styles.faqAnswer}>{item.a}</Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Grievance Officer & Contact */}
          <View style={styles.contactCard}>
            <Text style={styles.contactHeader}>Grievance & DPDP Nodal Officer</Text>
            <Text style={styles.contactText}>
              Name: Smt. Priya Narayanan{'\n'}
              Email: grievance@feevault.in • Phone: 1800-FEE-VAULT (Toll Free){'\n'}
              Escrow Compliance Desk: ICICI & HDFC Trust Services, Mumbai
            </Text>
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
  exceptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    elevation: 3,
  },
  exceptionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exceptionIcon: {
    fontSize: 22,
  },
  exceptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9F1239',
  },
  exceptionSub: {
    fontSize: 11,
    color: '#BE123C',
    marginTop: 2,
    lineHeight: 15,
  },
  exceptionArrow: {
    fontSize: 18,
    color: '#9F1239',
    marginLeft: 8,
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
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  raiseLink: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.feeBlue,
  },
  ticketItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketId: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.feeBlue,
    fontFamily: 'monospace',
  },
  ticketPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ticketPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  ticketSubject: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  ticketTime: {
    fontSize: 10.5,
    color: '#64748B',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 10,
  },
  faqItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
    lineHeight: 18,
  },
  faqToggleIcon: {
    fontSize: 10,
    color: '#64748B',
    marginLeft: 8,
  },
  faqAnswer: {
    fontSize: 11.5,
    lineHeight: 17,
    color: '#475569',
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
  },
  contactCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  contactHeader: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: 6,
  },
  contactText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#1E3A8A',
  },
});

export default HelpDeskScreen;
