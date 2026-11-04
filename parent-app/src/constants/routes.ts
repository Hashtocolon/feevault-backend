// ─────────────────────────────────────────────
//  FeeVault Parent App — Route Constants
// ─────────────────────────────────────────────

export const ROUTES = {
  // Auth
  SPLASH: 'SplashScreen',
  WELCOME_CAROUSEL: 'WelcomeCarouselScreen',
  LOGIN: 'LoginScreen',

  // Onboarding
  PARENTAL_CONSENT: 'ParentalConsentScreen',
  KYC_BANK_BINDING: 'KycBankBindingScreen',
  SECURITY_SETUP: 'SecuritySetupScreen',
  DEVICE_BOUND: 'DeviceBoundScreen',
  ADD_CHILD: 'AddChildScreen',

  // 🏠 STEP 2: Main Home Dashboard
  HOME: 'HomeScreen',

  // 💳 STEP 3: Make Payment / Add Savings
  MAKE_PAYMENT: 'MakePaymentScreen',
  PAYMENT_ROUTE: 'PaymentRouteScreen',
  PAYMENT_SUCCESS: 'PaymentSuccessScreen',
  PAYMENT_STATUS: 'PaymentStatusScreen',

  // 👨‍👧‍👦 STEP 4: My Kids
  CHILD_DETAIL: 'ChildDetailScreen',
  SCHOOL_DOCUMENTS: 'SchoolDocumentsScreen',
  CO_PARENT_INVITE: 'CoParentInviteScreen',
  CLASS_ROLLOVER: 'ClassRolloverScreen',

  // 📜 STEP 5A: Statements & Tax
  STATEMENTS_HUB: 'StatementsHubScreen',

  // 💬 STEP 5B: Support & Exceptions
  HELP_DESK: 'HelpDeskScreen',
  FILE_EXCEPTION: 'FileExceptionScreen',
} as const;

export type RouteKeys = typeof ROUTES[keyof typeof ROUTES];
