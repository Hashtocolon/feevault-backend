// ─────────────────────────────────────────────
//  AddChildScreen — Add First Child / Student
//  Step 5 of 5 in onboarding flow
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
import {PillBadge} from '../../../components/PillBadge';
import Header from '../../../components/Header';
import {ROUTES} from '../../../constants/routes';
import {RootStackParamList} from '../../../navigation/AppNavigator';

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
  schoolName: string;
  schoolCode: string;
  selectedClass: string;
}

const EMPTY_FORM: FormState = {
  fullName: '',
  gender: '',
  dob: '',
  schoolName: '',
  schoolCode: '',
  selectedClass: '',
};

// ─────────────────────────────────────────────
const AddChildScreen: React.FC = () => {
  const navigation = useNavigation<AddChildNav>();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

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

        {/* ── Header ── */}
        <Header title="Add Child" onBackPress={() => navigation.goBack()} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* ── Badge ── */}
          <PillBadge
            label="STUDENT PROFILE SETUP"
            style={styles.pill}
          />

          {/* ── Heading ── */}
          <Text style={styles.title}>Tell us about your child</Text>
          <Text style={styles.subtitle}>
            Required to link with the correct school fee vault
          </Text>

          {/* ── Progress indicator ── */}
          <View style={styles.progressRow}>
            {[1, 2, 3, 4, 5].map(step => (
              <View
                key={step}
                style={[
                  styles.progressDot,
                  step === 5 && styles.progressDotActive,
                  step < 5 && styles.progressDotDone,
                ]}
              />
            ))}
            <Text style={styles.progressLabel}>Step 5 of 5</Text>
          </View>

          {/* ── Glass card: Student Details ── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Student Details</Text>

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

            {/* School Name */}
            <CustomInput
              label="School Name"
              placeholder="e.g. Delhi Public School"
              value={form.schoolName}
              onChangeText={v => setField('schoolName', v)}
            />

            {/* School Code */}
            <CustomInput
              label="School Code"
              placeholder="School code from admin (e.g. DPS-001)"
              autoCapitalize="characters"
              value={form.schoolCode}
              onChangeText={v => setField('schoolCode', v)}
            />

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

          {/* ── Save & View Dashboard ── */}
          <CustomButton
            label="Save & View Dashboard →"
            onPress={handleSave}
            style={styles.saveBtn}
          />

          {/* ── Add Another Child ── */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleAddAnother}
            style={styles.addAnotherBtn}>
            <Text style={styles.addAnotherText}>＋ Add Another Child</Text>
          </TouchableOpacity>

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
    paddingBottom: 40,
  },

  // ── Badge
  pill: {
    marginTop: 8,
    marginBottom: 16,
  },

  // ── Heading
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textDark,
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMid,
    lineHeight: 20,
    marginBottom: 16,
  },

  // ── Progress
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.progressTrack,
  },
  progressDotDone: {
    backgroundColor: COLORS.feeBlue,
    opacity: 0.4,
  },
  progressDotActive: {
    backgroundColor: COLORS.feeBlue,
    width: 24,
    borderRadius: 5,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMid,
    marginLeft: 6,
  },

  // ── Glass card
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.feeBlue,
    marginBottom: 16,
    letterSpacing: 0.1,
  },

  // ── Field label (shared)
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMid,
    marginBottom: 8,
    letterSpacing: 0.2,
  },

  // ── Gender pills
  genderRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  genderPill: {
    flex: 1,
    paddingVertical: 10,
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
  addAnotherBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  addAnotherText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMid,
    textDecorationLine: 'underline',
  },
});

export default AddChildScreen;
