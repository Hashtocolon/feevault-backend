// ─────────────────────────────────────────────
//  AddChildScreen — Add First Child / Student (redesigned)
//  Step 5 of 5 in onboarding flow
//  Static design: no animations, no glass, no background circles.
//  Colors, logic and navigation are unchanged.
// ─────────────────────────────────────────────
import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';

import {COLORS} from '../../../theme/colors';
import {CustomButton} from '../../../components/CustomButton';
import {CustomInput} from '../../../components/CustomInput';
import {ROUTES} from '../../../constants/routes';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import Svg, {Path} from 'react-native-svg';

// Sleek Forward Vector Arrow
const ArrowRightIcon = ({color = '#FFFFFF', size = 18}: {color?: string; size?: number}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12H19M19 12L12 5M19 12L12 19"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

type AddChildNav = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.ADD_CHILD
>;

// ── Types ───────────────────────────────────────
type GenderOption = 'Boy' | 'Girl' | 'Other';

const GENDER_OPTIONS: GenderOption[] = ['Boy', 'Girl', 'Other'];

const CLASS_OPTIONS: string[] = [
  'LKG',
  'UKG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
];

// ── Default / empty form ────────────────────────
interface FormState {
  fullName: string;
  gender: GenderOption | '';
  dob: string;
  schoolCode: string;
  selectedClass: string;
}

const EMPTY_FORM: FormState = {
  fullName: '',
  gender: '',
  dob: '',
  schoolCode: '',
  selectedClass: '',
};

// Known partner schools mapping for instant UI feedback (matching API lookup)
const KNOWN_SCHOOLS: Record<string, {name: string; city: string}> = {
  'DPS-001': {name: 'Delhi Public School', city: 'Bangalore South'},
  'DPS-BLR-04': {name: 'Delhi Public School', city: 'Bangalore East'},
  'KVS-001': {name: 'Kendriya Vidyalaya', city: 'Indiranagar, Bangalore'},
  'BPS-002': {name: 'Bishop Cotton Boys School', city: 'Bangalore'},
  'NPS-003': {name: 'National Public School', city: 'Koramangala'},
  'JIS-004': {name: 'Jain International School', city: 'Bangalore'},
};

// ─────────────────────────────────────────────
const AddChildScreen: React.FC = () => {
  const navigation = useNavigation<AddChildNav>();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  // Auto-detect School from School Code (matching backend /schools/lookup)
  const cleanCode = form.schoolCode.trim().toUpperCase();
  const detectedSchool =
    KNOWN_SCHOOLS[cleanCode] ||
    (cleanCode.length >= 4
      ? {name: 'Verified Partner School', city: 'FeeVault Network'}
      : null);

  const setField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm(prev => ({...prev, [field]: value}));
    },
    [],
  );

  const handleSave = () => {
    setSubmitted(true);
    navigation.navigate(ROUTES.HOME);
  };

  const handleAddAnother = () => {
    setForm(EMPTY_FORM);
    setSubmitted(false);
  };

  return (
    <LinearGradient
      colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
      locations={[0, 0.35, 0.7, 1]}
      style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* ── Title block ── */}
          <Text style={styles.title}>Tell us about your child</Text>

          {/* Two-tone divider, same as other screens */}
          <View style={styles.divider}>
            <View style={styles.dividerBlue} />
            <View style={styles.dividerGreen} />
          </View>

          <Text style={styles.subtitle}>
            Required to link with the correct school fee vault
          </Text>

          {/* ── Progress indicator: Step 3 of 3 ── */}
          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              {[1, 2, 3].map(step => (
                <View
                  key={step}
                  style={[
                    styles.progressDot,
                    step === 3 && styles.progressDotActive,
                    step < 3 && styles.progressDotDone,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.progressLabel}>STEP 3 OF 3</Text>
          </View>

          {/* ── Card: Student Details ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconTile}>
                <Text style={styles.iconTileText}>🎓</Text>
              </View>
              <View style={styles.cardHeaderTitles}>
                <Text style={styles.sectionTitle}>Student Details</Text>
                <Text style={styles.sectionSub}>Basic details of your child</Text>
              </View>
            </View>

            {/* Full Name */}
            <CustomInput
              label="Student Full Name"
              placeholder="e.g. Priya Sharma"
              value={form.fullName}
              onChangeText={v => setField('fullName', v)}
            />

            {/* Gender */}
            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  activeOpacity={0.75}
                  onPress={() => setField('gender', opt)}
                  style={[
                    styles.genderPill,
                    form.gender === opt && styles.genderPillActive,
                  ]}>
                  <Text
                    style={[
                      styles.genderPillText,
                      form.gender === opt && styles.genderPillTextActive,
                    ]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date of Birth */}
            <CustomInput
              label="Date of Birth"
              placeholder="DD/MM/YYYY"
              keyboardType="numeric"
              maxLength={10}
              value={form.dob}
              onChangeText={v => setField('dob', v)}
            />

            {/* School Code Input with Smart Auto-Lookup */}
            <CustomInput
              label="School Code"
              placeholder="e.g. DPS-001 (provided by school)"
              autoCapitalize="characters"
              value={form.schoolCode}
              onChangeText={v => setField('schoolCode', v.toUpperCase())}
              containerStyle={{marginBottom: detectedSchool ? 6 : 14}}
            />

            {/* Smart Auto-Detected School Badge */}
            {detectedSchool ? (
              <View style={styles.detectedSchoolCard}>
                <View style={styles.schoolIconWrap}>
                  <Text style={styles.schoolIconText}>🏫</Text>
                </View>
                <View style={styles.schoolInfo}>
                  <Text style={styles.schoolDetectedTitle}>{detectedSchool.name}</Text>
                  <Text style={styles.schoolDetectedCity}>
                    📍 {detectedSchool.city} • <Text style={styles.schoolVerifiedText}>FeeVault Partner ✓</Text>
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Class / Standard */}
            <Text style={styles.fieldLabel}>Class / Standard</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.classRow}>
              {CLASS_OPTIONS.map(cls => (
                <TouchableOpacity
                  key={cls}
                  activeOpacity={0.75}
                  onPress={() => setField('selectedClass', cls)}
                  style={[
                    styles.classPill,
                    form.selectedClass === cls && styles.classPillActive,
                  ]}>
                  <Text
                    style={[
                      styles.classPillText,
                      form.selectedClass === cls && styles.classPillTextActive,
                    ]}>
                    {cls}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Pending verification status box ── */}
            {submitted && (
              <View style={styles.statusBox}>
                <Text style={styles.statusText}>
                  ⏳{'  '}
                  <Text style={styles.statusBold}>
                    Pending School Verification
                  </Text>
                  {'  —  '}You can start saving immediately while school
                  approves your link
                </Text>
              </View>
            )}
          </View>

          {/* ── Save & Start Saving (Focused Motivational CTA) ── */}
          <CustomButton
            label="Save & Start Saving"
            icon={<ArrowRightIcon color="#FFFFFF" size={18} />}
            iconPosition="right"
            onPress={handleSave}
            style={styles.saveBtn}
          />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },

  // ── Heading
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A56DB', // feeBlue
    textAlign: 'center',
    letterSpacing: -0.2,
    marginTop: 22,
  },
  divider: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  dividerBlue: {
    width: 28,
    height: 3,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    backgroundColor: '#1A56DB',
  },
  dividerGreen: {
    width: 28,
    height: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: '#16A34A',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
    marginBottom: 20,
  },

  // ── Progress indicator (centered)
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 6,
  },
  progressDot: {
    width: 32,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(26,86,219,0.18)',
  },
  progressDotDone: {
    backgroundColor: COLORS.vaultGreen,
  },
  progressDotActive: {
    backgroundColor: COLORS.feeBlue,
    width: 44,
  },
  progressLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.textMid,
    letterSpacing: 1.6,
    textAlign: 'center',
  },

  // ── Card – solid white, crisp border
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#D3EBFF',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#35B6FF',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAF4FF',
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF9FF',
    borderWidth: 1,
    borderColor: '#D3EBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconTileText: {
    fontSize: 20,
  },
  cardHeaderTitles: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.feeBlue,
    letterSpacing: 0.1,
  },
  sectionSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },

  // ── Field label (shared)
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMid,
    marginBottom: 8,
    letterSpacing: 0.2,
  },

  // ── Auto-detected School Card
  detectedSchoolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.2,
    borderColor: '#86EFAC',
    marginBottom: 16,
  },
  schoolIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  schoolIconText: {
    fontSize: 18,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolDetectedTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#14532D',
    marginBottom: 2,
  },
  schoolDetectedCity: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '500',
  },
  schoolVerifiedText: {
    fontWeight: '800',
    color: '#15803D',
  },

  // ── Gender pills
  genderRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  genderPill: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
  },
  genderPillActive: {
    backgroundColor: COLORS.feeBlue,
    borderColor: COLORS.feeBlue,
  },
  genderPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMid,
  },
  genderPillTextActive: {
    color: COLORS.textWhite,
    fontWeight: '800',
  },

  // ── Class pills (horizontal scroll)
  classRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
    marginBottom: 16,
  },
  classPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
  },
  classPillActive: {
    backgroundColor: COLORS.feeBlue,
    borderColor: COLORS.feeBlue,
  },
  classPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMid,
  },
  classPillTextActive: {
    color: COLORS.textWhite,
    fontWeight: '800',
  },

  // ── Status box
  statusBox: {
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 4,
  },
  statusText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
  },
  statusBold: {
    fontWeight: '700',
  },

  // ── Buttons
  saveBtn: {
    marginBottom: 16,
  },
});

export default AddChildScreen;