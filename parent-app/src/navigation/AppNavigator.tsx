import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../constants/routes';

// ── Auth & Onboarding Screens ────────────────
import SplashScreen from '../modules/auth/screens/SplashScreen';
import LoginScreen from '../modules/auth/screens/LoginScreen';
import WelcomeCarouselScreen from '../modules/onboarding/screens/WelcomeCarouselScreen';
import KycBankBindingScreen from '../modules/onboarding/screens/KycBankBindingScreen';
import AddChildScreen from '../modules/onboarding/screens/AddChildScreen';

// ── STEP 2: Home Dashboard ───────────────────
import HomeScreen from '../modules/home/screens/HomeScreen';

// ── STEP 3: Make Payment / Add Savings ────────
import MakePaymentScreen from '../modules/payments/screens/MakePaymentScreen';
import PaymentRouteScreen from '../modules/payments/screens/PaymentRouteScreen';
import PaymentSuccessScreen from '../modules/payments/screens/PaymentSuccessScreen';
import PaymentStatusScreen from '../modules/payments/screens/PaymentStatusScreen';

// ── STEP 4: My Kids & Documents ───────────────
import ChildDetailScreen from '../modules/kids/screens/ChildDetailScreen';
import SchoolDocumentsScreen from '../modules/kids/screens/SchoolDocumentsScreen';
import CoParentInviteScreen from '../modules/kids/screens/CoParentInviteScreen';
import ClassRolloverScreen from '../modules/kids/screens/ClassRolloverScreen';

// ── STEP 5A: Statements & Tax ─────────────────
import StatementsHubScreen from '../modules/statements/screens/StatementsHubScreen';

// ── STEP 5B: Help Desk & Exceptions ───────────
import HelpDeskScreen from '../modules/support/screens/HelpDeskScreen';
import FileExceptionScreen from '../modules/support/screens/FileExceptionScreen';

export type RootStackParamList = {
  // Auth & Onboarding
  [ROUTES.SPLASH]: undefined;
  [ROUTES.WELCOME_CAROUSEL]: undefined;
  [ROUTES.LOGIN]: undefined;
  [ROUTES.PARENTAL_CONSENT]: undefined;
  [ROUTES.KYC_BANK_BINDING]: undefined;
  [ROUTES.SECURITY_SETUP]: undefined;
  [ROUTES.DEVICE_BOUND]: undefined;
  [ROUTES.ADD_CHILD]: undefined;

  // STEP 2: Main Home Dashboard
  [ROUTES.HOME]: undefined;

  // STEP 3: Make Payment / Add Savings
  [ROUTES.MAKE_PAYMENT]: undefined;
  [ROUTES.PAYMENT_ROUTE]: undefined;
  [ROUTES.PAYMENT_SUCCESS]: undefined;
  [ROUTES.PAYMENT_STATUS]: undefined;

  // STEP 4: My Kids
  [ROUTES.CHILD_DETAIL]: undefined;
  [ROUTES.SCHOOL_DOCUMENTS]: undefined;
  [ROUTES.CO_PARENT_INVITE]: undefined;
  [ROUTES.CLASS_ROLLOVER]: undefined;

  // STEP 5A: Statements & Tax
  [ROUTES.STATEMENTS_HUB]: undefined;

  // STEP 5B: Support & Exceptions
  [ROUTES.HELP_DESK]: undefined;
  [ROUTES.FILE_EXCEPTION]: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={ROUTES.SPLASH}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}>
        {/* Onboarding Stack */}
        <Stack.Screen
          name={ROUTES.SPLASH}
          component={SplashScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen name={ROUTES.WELCOME_CAROUSEL} component={WelcomeCarouselScreen} />
        <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
        <Stack.Screen name={ROUTES.KYC_BANK_BINDING} component={KycBankBindingScreen} />
        <Stack.Screen name={ROUTES.ADD_CHILD} component={AddChildScreen} />

        {/* STEP 2: Home Dashboard */}
        <Stack.Screen name={ROUTES.HOME} component={HomeScreen} />

        {/* STEP 3: Make Payment / Add Savings */}
        <Stack.Screen name={ROUTES.MAKE_PAYMENT} component={MakePaymentScreen} />
        <Stack.Screen name={ROUTES.PAYMENT_ROUTE} component={PaymentRouteScreen} />
        <Stack.Screen name={ROUTES.PAYMENT_SUCCESS} component={PaymentSuccessScreen} />
        <Stack.Screen name={ROUTES.PAYMENT_STATUS} component={PaymentStatusScreen} />

        {/* STEP 4: My Kids */}
        <Stack.Screen name={ROUTES.CHILD_DETAIL} component={ChildDetailScreen} />
        <Stack.Screen name={ROUTES.SCHOOL_DOCUMENTS} component={SchoolDocumentsScreen} />
        <Stack.Screen name={ROUTES.CO_PARENT_INVITE} component={CoParentInviteScreen} />
        <Stack.Screen name={ROUTES.CLASS_ROLLOVER} component={ClassRolloverScreen} />

        {/* STEP 5A: Statements & Tax */}
        <Stack.Screen name={ROUTES.STATEMENTS_HUB} component={StatementsHubScreen} />

        {/* STEP 5B: Support & Exceptions */}
        <Stack.Screen name={ROUTES.HELP_DESK} component={HelpDeskScreen} />
        <Stack.Screen name={ROUTES.FILE_EXCEPTION} component={FileExceptionScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
