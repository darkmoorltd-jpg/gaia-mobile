import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

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
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    documentNumber?: string;
    faceMatchScore?: number;
  };
}

// Helper to compress and convert image to base64
async function getBase64(uri: string): Promise<string> {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return manipResult.base64 || '';
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
          firstName: json.entity.first_name,
          lastName: json.entity.last_name,
          dateOfBirth: json.entity.date_of_birth,
        },
      };
    }
    return { success: false, message: json.error || 'BVN not found' };
  } catch (e: any) {
    return { success: false, message: e.message || 'Network error' };
  }
}

// ============================================================
// Verify NIN
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
          firstName: json.entity.first_name,
          lastName: json.entity.last_name,
          dateOfBirth: json.entity.date_of_birth,
        },
      };
    }
    return { success: false, message: json.error || 'NIN not found' };
  } catch (e: any) {
    return { success: false, message: e.message || 'Network error' };
  }
}

// ============================================================
// Verify Global Document + Face Match
// ============================================================
export async function verifyDocumentAndFace(
  idUri: string,
  selfieUri: string,
  documentType: string, // e.g. 'PASSPORT', 'DRIVERS_LICENSE'
  countryCode: string   // e.g. 'NG', 'GH', 'KE', 'US', 'GB'
): Promise<KYCResult> {
  try {
    // 1. Convert images to base64
    const idBase64 = await getBase64(idUri);
    const selfieBase64 = await getBase64(selfieUri);

    // 2. Document OCR Verification
    const docRes = await fetch(`${DOJAH_BASE}/document`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        image: idBase64,
        document_type: documentType,
        document_country: countryCode,
      }),
    });
    const docJson = await docRes.json();

    if (!docRes.ok) {
      return { success: false, message: docJson.error || 'Document unreadable' };
    }

    // 3. Face Match
    const faceRes = await fetch(`${DOJAH_BASE}/kyc/face`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        selfie_image: selfieBase64,
        photoid_image: idBase64, // Dojah can extract the face from the ID
      }),
    });
    const faceJson = await faceRes.json();

    if (!faceRes.ok) {
      return { success: false, message: faceJson.error || 'Face match failed' };
    }

    // Dojah typically returns a confidence score between 0 and 100
    const score = faceJson.entity?.match_score || faceJson.entity?.confidence || 0;
    
    if (score < 70) {
      return { success: false, message: `Face match too low (${score}%)` };
    }

    return {
      success: true,
      message: 'Document and Face verified!',
      data: {
        firstName: docJson.entity?.first_name || '',
        lastName: docJson.entity?.last_name || '',
        documentNumber: docJson.entity?.document_number || '',
        faceMatchScore: score,
      },
    };
  } catch (e: any) {
    return { success: false, message: e.message || 'Network error' };
  }
}
