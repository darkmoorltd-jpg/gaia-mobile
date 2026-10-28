// Per-country payment configuration
// All countries use Paystack; currency varies (Paystack supports NGN/GHS/ZAR/KES/USD)

export type PaymentConfig = {
  gateway: 'paystack' | 'manual';
  currency: string;
  currencySymbol: string;
  fee: number;
  feeLabel: string;
};

export const PAYMENT_BY_COUNTRY: Record<string, PaymentConfig> = {
  // Africa — Paystack supported
  NG: { gateway: 'paystack', currency: 'NGN', currencySymbol: '₦', fee: 2000, feeLabel: '₦2,000' },
  GH: { gateway: 'paystack', currency: 'GHS', currencySymbol: '₵', fee: 20, feeLabel: '₵20' },
  KE: { gateway: 'paystack', currency: 'KES', currencySymbol: 'KSh', fee: 250, feeLabel: 'KSh 250' },
  ZA: { gateway: 'paystack', currency: 'ZAR', currencySymbol: 'R', fee: 25, feeLabel: 'R25' },
  CI: { gateway: 'paystack', currency: 'XOF', currencySymbol: 'CFA', fee: 1500, feeLabel: 'CFA 1,500' },
  // Other African — manual for now
  TZ: { gateway: 'manual', currency: 'TZS', currencySymbol: 'TSh', fee: 5000, feeLabel: 'TSh 5,000' },
  UG: { gateway: 'manual', currency: 'UGX', currencySymbol: 'USh', fee: 7500, feeLabel: 'USh 7,500' },
  ET: { gateway: 'manual', currency: 'ETB', currencySymbol: 'Br', fee: 70, feeLabel: 'Br 70' },
  CM: { gateway: 'manual', currency: 'XAF', currencySymbol: 'FCFA', fee: 1200, feeLabel: 'FCFA 1,200' },
  SN: { gateway: 'manual', currency: 'XOF', currencySymbol: 'CFA', fee: 1200, feeLabel: 'CFA 1,200' },
  EG: { gateway: 'manual', currency: 'EGP', currencySymbol: 'E£', fee: 60, feeLabel: 'E£60' },
  MA: { gateway: 'manual', currency: 'MAD', currencySymbol: 'DH', fee: 20, feeLabel: 'DH 20' },

  // North America — USD via Paystack international
  US: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2' },
  CA: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },
  MX: { gateway: 'manual', currency: 'MXN', currencySymbol: '$', fee: 35, feeLabel: '$35 MXN' },

  // Europe — USD via Paystack international
  GB: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },
  DE: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },
  FR: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },
  IT: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },
  ES: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },
  NL: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },
  PT: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },
  IE: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },
  PL: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },
  SE: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },
  CH: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },

  // Asia — USD via Paystack international
  IN: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 2, feeLabel: '$2 USD' },
  PK: { gateway: 'manual', currency: 'PKR', currencySymbol: '₨', fee: 550, feeLabel: '₨550' },
  BD: { gateway: 'manual', currency: 'BDT', currencySymbol: '৳', fee: 220, feeLabel: '৳220' },
  CN: { gateway: 'manual', currency: 'CNY', currencySymbol: '¥', fee: 15, feeLabel: '¥15' },
  JP: { gateway: 'manual', currency: 'JPY', currencySymbol: '¥', fee: 300, feeLabel: '¥300' },
  KR: { gateway: 'manual', currency: 'KRW', currencySymbol: '₩', fee: 2700, feeLabel: '₩2,700' },
  PH: { gateway: 'manual', currency: 'PHP', currencySymbol: '₱', fee: 115, feeLabel: '₱115' },
  ID: { gateway: 'manual', currency: 'IDR', currencySymbol: 'Rp', fee: 32000, feeLabel: 'Rp 32,000' },
  VN: { gateway: 'manual', currency: 'VND', currencySymbol: '₫', fee: 50000, feeLabel: '₫50,000' },
  TH: { gateway: 'manual', currency: 'THB', currencySymbol: '฿', fee: 70, feeLabel: '฿70' },
  MY: { gateway: 'manual', currency: 'MYR', currencySymbol: 'RM', fee: 9, feeLabel: 'RM9' },
  SA: { gateway: 'manual', currency: 'SAR', currencySymbol: '﷼', fee: 8, feeLabel: '﷼8' },
  AE: { gateway: 'manual', currency: 'AED', currencySymbol: 'د.إ', fee: 8, feeLabel: 'AED 8' },
  IL: { gateway: 'manual', currency: 'ILS', currencySymbol: '₪', fee: 8, feeLabel: '₪8' },
  TR: { gateway: 'manual', currency: 'TRY', currencySymbol: '₺', fee: 70, feeLabel: '₺70' },

  // South America — USD via Paystack international
  BR: { gateway: 'manual', currency: 'BRL', currencySymbol: 'R$', fee: 10, feeLabel: 'R$10' },
  AR: { gateway: 'manual', currency: 'ARS', currencySymbol: '$', fee: 2000, feeLabel: '$2,000 ARS' },
  CO: { gateway: 'manual', currency: 'COP', currencySymbol: '$', fee: 8000, feeLabel: '$8,000 COP' },
  CL: { gateway: 'manual', currency: 'CLP', currencySymbol: '$', fee: 1900, feeLabel: '$1,900 CLP' },
  PE: { gateway: 'manual', currency: 'PEN', currencySymbol: 'S/', fee: 8, feeLabel: 'S/8' },

  // Oceania — USD via Paystack international
  AU: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 3, feeLabel: '$3 USD' },
  NZ: { gateway: 'paystack', currency: 'USD', currencySymbol: '$', fee: 3, feeLabel: '$3 USD' },
};

export const DEFAULT_PAYMENT: PaymentConfig = {
  gateway: 'paystack',
  currency: 'USD',
  currencySymbol: '$',
  fee: 2,
  feeLabel: '$2 USD',
};

// ============================================================
// Paystack (Nigerian merchant) only accepts NGN.
// We display the local price to the user, but charge NGN.
// Approximate FX rates — update weekly via admin.
// ============================================================
export const NGN_RATES: Record<string, number> = {
  NGN: 1, USD: 1600, GHS: 105, KES: 12, ZAR: 85,
  BRL: 290, XOF: 2.6, EGP: 32, INR: 19, EUR: 1720,
  GBP: 2020, JPY: 10.5, CNY: 220, CAD: 1160, AUD: 1040,
  MXN: 80, TRY: 45, AED: 435, SAR: 425, ILS: 430,
  PKR: 5.7, BDT: 13.5, PHP: 28, IDR: 0.10, VND: 0.065,
  THB: 45, MYR: 360, KRW: 1.15, TZS: 0.62, UGX: 0.42,
  ETB: 14, XAF: 2.6, MAD: 160, CLP: 1.7, COP: 0.40,
  PEN: 425, ARS: 1.8, NZD: 950, CHF: 1800, PLN: 400,
  SEK: 150, NOK: 150, DKK: 230, CZK: 70, HUF: 4.5,
};

export function toNaira(amount: number, currency: string): number {
  const rate = NGN_RATES[currency.toUpperCase()] || 1600;
  return Math.round(amount * rate / 10) * 10; // round to nearest ₦10
}

export function nairaLabel(amountNgn: number): string {
  return '₦' + amountNgn.toLocaleString('en-NG');
}

export function getPaymentConfig(countryCode: string): PaymentConfig {
  const code = (countryCode || 'NG').toUpperCase();
  return PAYMENT_BY_COUNTRY[code] || DEFAULT_PAYMENT;
}
