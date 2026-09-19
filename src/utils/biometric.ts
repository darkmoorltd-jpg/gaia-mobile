import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEY_ENABLED = 'gaia.biometric.enabled';
const KEY_EMAIL = 'gaia.biometric.email';
const KEY_REFRESH = 'gaia.biometric.refresh';

export interface BiometricStatus {
  available: boolean;
  enrolled: boolean;
  type: string | null;
}

export async function checkBiometricSupport(): Promise<BiometricStatus> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    let typeLabel: string | null = null;
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) typeLabel = 'Face ID';
    else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) typeLabel = 'Fingerprint';
    else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) typeLabel = 'Iris';
    return { available: hasHardware, enrolled: isEnrolled, type: typeLabel };
  } catch { return { available: false, enrolled: false, type: null }; }
}

export async function enableBiometric(email: string, refreshToken: string): Promise<boolean> {
  try {
    const support = await checkBiometricSupport();
    if (!support.available || !support.enrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Enable biometric unlock for GAIA',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });
    if (!result.success) return false;
    await SecureStore.setItemAsync(KEY_ENABLED, 'true');
    await SecureStore.setItemAsync(KEY_EMAIL, email);
    await SecureStore.setItemAsync(KEY_REFRESH, refreshToken);
    return true;
  } catch { return false; }
}

export async function disableBiometric(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_ENABLED);
    await SecureStore.deleteItemAsync(KEY_EMAIL);
    await SecureStore.deleteItemAsync(KEY_REFRESH);
  } catch {}
}

export async function isBiometricEnabled(): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(KEY_ENABLED)) === 'true'; }
  catch { return false; }
}

export async function getBiometricEmail(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(KEY_EMAIL); } catch { return null; }
}

export async function getBiometricRefresh(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(KEY_REFRESH); } catch { return null; }
}

export async function promptBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock GAIA',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch { return false; }
}
