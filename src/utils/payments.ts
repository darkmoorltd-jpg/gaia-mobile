import { useLocale } from '../store/locale';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export const ANNUAL_PRICE_USD = 100;
export const ANNUAL_DURATION_DAYS = 365;

// Countries where Stripe + $100/year unlimited is available
export const STRIPE_COUNTRIES = new Set([
  // Europe
  'GB','IE','FR','DE','NL','BE','CH','AT','IT','ES','PT','GR','PL','CZ',
  'HU','RO','BG','HR','FI','SE','NO','DK','UA','RU',
  // North America
  'US','CA','MX',
  // Oceania
  'AU','NZ',
  // Asia
  'IN','CN','JP','KR','ID','VN','TH','PH','MY','SG','PK','BD','LK','NP',
  'MM','KH','LA',
  // Middle East / Arab
  'SA','AE','EG','MA','DZ','TN','LY','SD','IQ','JO','LB','KW','QA','BH',
  'OM','YE','PS','SY','TR','IL','IR'
]);

// Countries where Flutterwave is available (West + East Africa fallback)
export const FLUTTERWAVE_COUNTRIES = new Set([
  'NG','GH','KE','ZA','UG','TZ','RW','ZM','MW','MZ','BW','NA','AO',
  'SN','CI','ML','BF','BJ','TG','NE','GN','SL','LR','GM','CM','CD','CG','GA'
]);

export function getPayProviders(): ('paystack'|'flutterwave'|'stripe')[] {
  const country = useLocale.getState().country;
  const code = (country?.code || 'NG').toUpperCase();

  if (STRIPE_COUNTRIES.has(code)) return ['stripe'];
  if (FLUTTERWAVE_COUNTRIES.has(code)) return ['flutterwave', 'paystack'];
  return ['paystack'];
}

export function isStripeCountry(): boolean {
  const country = useLocale.getState().country;
  return STRIPE_COUNTRIES.has((country?.code || 'NG').toUpperCase());
}

export function isUnlimitedEligible(): boolean {
  return isStripeCountry();
}

// Create Stripe Checkout for annual plan
export async function payAnnualUnlimited() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) { Alert.alert('Sign in required'); return; }

  const country = useLocale.getState().country;
  const code = (country?.code || 'NG').toUpperCase();

  if (!STRIPE_COUNTRIES.has(code)) {
    Alert.alert('Not available', 'The $100/year unlimited plan is only for UK, EU, USA and select countries.');
    return;
  }

  try {
    const r = await fetch(API_BASE + '/stripe/create-annual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        country_code: code,
        email: user.email,
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error('HTTP ' + r.status + ': ' + err.slice(0, 100));
    }
    const data = await r.json();
    Alert.alert(
      'Unlimited Scans — $100/year',
      'You will be charged $100 USD for 1 year of unlimited scans.\n\nOpen Stripe checkout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open', onPress: () => Linking.openURL(data.checkout_url) },
      ],
    );
  } catch (e: any) {
    Alert.alert('Payment error', e?.message || 'Try again');
  }
}

// Check if user has active unlimited subscription
export async function hasActiveUnlimited(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('user_scans')
    .select('unlimited_until, plan')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data) return false;
  if (data.plan !== 'unlimited_year') return false;
  if (!data.unlimited_until) return false;
  return new Date(data.unlimited_until) > new Date();
}

// Format price based on user's currency
export function formatAnnualPrice(): string {
  const country = useLocale.getState().country;
  const sym = country?.currency_symbol || '$';
  const currency = (country?.currency || 'USD').toUpperCase();
  const rate = useLocale.getState().rate || 1;

  // Rates are NGN per 1 unit of local currency
  // Convert $100 USD → NGN → local currency
  const ngnPerUsd = 1550;
  const ngnPrice = 100 * ngnPerUsd;
  const localPrice = Math.round(ngnPrice * rate);

  if (['USD', 'GBP', 'EUR', 'CAD', 'AUD'].includes(currency)) {
    // Use proper symbol
    const map: any = { USD: '$100', GBP: '£100', EUR: '€100', CAD: 'C$100', AUD: 'A$100' };
    return map[currency] || '$100';
  }
  // Non-major currency — show local conversion
  return sym + localPrice.toLocaleString();
}
