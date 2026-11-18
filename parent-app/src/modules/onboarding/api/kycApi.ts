// ─────────────────────────────────────────────
//  FeeVault Parent App — KYC & Bank API Service
//  Connects "Link Your Bank" to Render Backend
// ─────────────────────────────────────────────

import apiClient from '../../../api/apiClient';

export interface KycBankPayload {
  pan_number: string;
  bank_account_number: string;
  ifsc_code: string;
  account_holder_name: string;
}

export interface KycBankData {
  pan_number: string;
  bank_account_number: string;
  ifsc_code: string;
  account_holder_name?: string;
  verified_name?: string;
  is_bank_verified: boolean;
  penny_drop_reference?: string;
}

export interface KycBankResponse {
  success: boolean;
  message: string;
  data: KycBankData;
}

/**
 * Submit PAN and Bank details for ₹1 Penny-Drop verification
 */
export const submitKycAndBank = async (payload: KycBankPayload): Promise<KycBankResponse> => {
  try {
    const response = await apiClient.post<KycBankResponse>('/parent/kyc-bank', payload);
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.message ||
      'Failed to verify bank account. Please check your network connection.';
    throw new Error(message);
  }
};

/**
 * Fetch current verified bank details for the logged-in parent
 */
export const getKycAndBank = async (): Promise<KycBankData | null> => {
  try {
    const response = await apiClient.get<KycBankResponse>('/parent/kyc-bank');
    return response.data?.data || null;
  } catch {
    // If not set yet, return null
    return null;
  }
};
