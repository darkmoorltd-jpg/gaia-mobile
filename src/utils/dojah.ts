// ============================================================
// DOJAH KYC UTILITIES
// Get your App ID and Secret Key at https://dashboard.dojah.io/
// ============================================================

const DOJAH_APP_ID = 'YOUR_DOJAH_APP_ID';      // Replace this
const DOJAH_SECRET_KEY = 'YOUR_DOJAH_SECRET';  // Replace this
const DOJAH_BASE = 'https://api.dojah.io/api/v1';

const headers = {
  'AppId': DOJAH_APP_ID,
  'Authorization': DOJAH_SECRET_KEY,
  'Content-Type': 'application/json',
};

export interface KYCResult {
  success: boolean;
  message: string;
  data?: {
    firstName: string;
    lastName: string;
    middleName?: string;
    dateOfBirth?: string;
    phone?: string;
    gender?: string;
    photo?: string;
  };
}

// ============================================================
// Verify BVN
// ============================================================
export async function verifyBVN(bvn: string): Promise<KYCResult> {
  try {
    const res = await fetch(`${DOJAH_BASE}/kyc/bvn`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ bvn }),
    });

    const json = await res.json();

    if (res.ok && json.entity) {
      return {
        success: true,
        message: 'BVN Verified successfully',
        data: {
          firstName: json.entity.first_name || '',
          lastName: json.entity.last_name || '',
          middleName: json.entity.middle_name || '',
          dateOfBirth: json.entity.date_of_birth || '',
          phone: json.entity.phone_number || '',
          gender: json.entity.gender || '',
        },
      };
    }

    return { success: false, message: json.error || 'BVN not found' };
  } catch (e: any) {
    return { success: false, message: e.message || 'Network error' };
  }
}

// ============================================================
// Verify NIN (National Identity Number)
// ============================================================
export async function verifyNIN(nin: string): Promise<KYCResult> {
  try {
    const res = await fetch(`${DOJAH_BASE}/kyc/nin`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ nin }),
    });

    const json = await res.json();

    if (res.ok && json.entity) {
      return {
        success: true,
        message: 'NIN Verified successfully',
        data: {
          firstName: json.entity.first_name || '',
          lastName: json.entity.last_name || '',
          middleName: json.entity.middle_name || '',
          dateOfBirth: json.entity.date_of_birth || '',
          phone: json.entity.phone || '',
          gender: json.entity.gender || '',
          photo: json.entity.photo || '',
        },
      };
    }

    return { success: false, message: json.error || 'NIN not found' };
  } catch (e: any) {
    return { success: false, message: e.message || 'Network error' };
  }
}
