// ─────────────────────────────────────────────
//  FeeVault Parent App — Auth API Service
//  Connects Login, Register & Forgot Password to Render Backend
// ─────────────────────────────────────────────

import apiClient, { setAuthToken } from '../../../api/apiClient';

export interface RegisterPayload {
  relation: 'Father' | 'Mother' | 'Guardian';
  full_name: string;
  phone: string;
  alternate_phone?: string;
  email?: string;
  password: string;
}

export interface LoginPayload {
  username: string; // Accepts Email, 10-digit Phone, or +91 Phone
  password: string;
  device_id?: string;
  fcm_token?: string;
}

export interface AuthUser {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  alternate_phone?: string;
  relation?: string;
  role: string;
  status: string;
  is_bank_verified?: boolean;
  dpdp_consent_recorded?: boolean;
  created_at?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: AuthUser;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  otp_preview?: string;
}

export interface ResetPasswordPayload {
  identifier: string;
  otp: string;
  new_password: string;
}

/**
 * Register a new parent account
 */
export const registerParent = async (payload: RegisterPayload): Promise<AuthResponse> => {
  try {
    const response = await apiClient.post<AuthResponse>('/auth/register', payload);
    if (response.data?.token) {
      setAuthToken(response.data.token);
    }
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.message ||
      'Registration failed. Please check your network connection.';
    throw new Error(message);
  }
};

/**
 * Log in an existing parent (via Email or Phone)
 */
export const loginParent = async (payload: LoginPayload): Promise<AuthResponse> => {
  try {
    const response = await apiClient.post<AuthResponse>('/auth/login', payload);
    if (response.data?.token) {
      setAuthToken(response.data.token);
    }
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.message ||
      'Invalid credentials. Please check your mobile/email and password.';
    throw new Error(message);
  }
};

/**
 * Request password reset OTP (via Email or Mobile)
 */
export const requestPasswordOtp = async (identifier: string): Promise<ForgotPasswordResponse> => {
  try {
    const response = await apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', {
      identifier,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.message ||
      'Failed to send verification code. Please check your network connection.';
    throw new Error(message);
  }
};

/**
 * Verify OTP and set a new password
 */
export const resetPasswordWithOtp = async (
  payload: ResetPasswordPayload,
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/auth/reset-password',
      payload,
    );
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.message ||
      'Failed to reset password. Please check your verification code.';
    throw new Error(message);
  }
};
