// ─────────────────────────────────────────────
//  FeeVault Parent App — Auth API Service
//  Connects Login & Register to Render Backend
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
