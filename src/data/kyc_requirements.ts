// Country-specific KYC field requirements

export type KycField = {
  key: string;
  label: string;
  placeholder: string;
  keyboard: 'default' | 'number-pad' | 'email-address';
  maxLength?: number;
  required: boolean;
};

export const KYC_BY_COUNTRY: Record<string, KycField[]> = {
  // ===== AFRICA =====
  NG: [
    { key: 'bvn', label: 'BVN (11 digits) *', placeholder: '12345678901', keyboard: 'number-pad', maxLength: 11, required: true },
    { key: 'nin', label: 'NIN (11 digits) *', placeholder: '12345678901', keyboard: 'number-pad', maxLength: 11, required: true },
  ],
  GH: [
    { key: 'ghana_card', label: 'Ghana Card Number *', placeholder: 'GHA-123456789-0', keyboard: 'default', maxLength: 15, required: true },
    { key: 'ghana_tin', label: 'Ghana TIN (optional)', placeholder: 'C0012345678', keyboard: 'default', required: false },
  ],
  KE: [
    { key: 'national_id', label: 'National ID (8 digits) *', placeholder: '12345678', keyboard: 'number-pad', maxLength: 8, required: true },
    { key: 'kra_pin', label: 'KRA PIN (optional)', placeholder: 'A123456789X', keyboard: 'default', required: false },
  ],
  ZA: [
    { key: 'sa_id', label: 'SA ID Number (13 digits) *', placeholder: '8001015009087', keyboard: 'number-pad', maxLength: 13, required: true },
    { key: 'passport', label: 'Passport (if not SA citizen)', placeholder: 'AB1234567', keyboard: 'default', required: false },
  ],
  CI: [
    { key: 'cni', label: 'CNI Number *', placeholder: 'CI0012345678', keyboard: 'default', required: true },
  ],
  TZ: [{ key: 'nida', label: 'NIDA Number *', placeholder: '19900101-12345-00001-01', keyboard: 'default', required: true }],
  UG: [{ key: 'nin', label: 'NIN Number *', placeholder: 'CM90012345ABC1', keyboard: 'default', required: true }],
  ET: [{ key: 'fayda', label: 'Fayda ID *', placeholder: '1234567890', keyboard: 'number-pad', required: true }],
  CM: [{ key: 'cni', label: 'CNI Number *', placeholder: '1234567890', keyboard: 'default', required: true }],
  SN: [{ key: 'ninea', label: 'NINEA / CNI *', placeholder: 'Enter ID', keyboard: 'default', required: true }],
  EG: [{ key: 'national_id', label: 'National ID (14 digits) *', placeholder: '12345678901234', keyboard: 'number-pad', maxLength: 14, required: true }],
  MA: [{ key: 'cin', label: 'CIN Number *', placeholder: 'AB123456', keyboard: 'default', required: true }],

  // ===== NORTH AMERICA =====
  US: [
    { key: 'ssn_last4', label: 'SSN (last 4 digits) *', placeholder: '1234', keyboard: 'number-pad', maxLength: 4, required: true },
    { key: 'state_id', label: 'State ID *', placeholder: 'AB1234567', keyboard: 'default', required: true },
  ],
  CA: [{ key: 'sin_last3', label: 'SIN (last 3 digits) *', placeholder: '123', keyboard: 'number-pad', maxLength: 3, required: true }],
  MX: [{ key: 'curp', label: 'CURP *', placeholder: 'ABCD123456HDFRRN01', keyboard: 'default', maxLength: 18, required: true }],

  // ===== EUROPE =====
  GB: [{ key: 'ni_number', label: 'NI Number *', placeholder: 'QQ123456C', keyboard: 'default', maxLength: 9, required: true }],
  DE: [{ key: 'personalausweis', label: 'Personalausweis Number *', placeholder: 'L01X00T47', keyboard: 'default', required: true }],
  FR: [{ key: 'insee', label: 'INSEE Number *', placeholder: '1234567890123', keyboard: 'number-pad', maxLength: 13, required: true }],
  IT: [{ key: 'codice_fiscale', label: 'Codice Fiscale *', placeholder: 'RSSMRA80A01H501U', keyboard: 'default', maxLength: 16, required: true }],
  ES: [{ key: 'dni', label: 'DNI / NIE *', placeholder: '12345678A', keyboard: 'default', maxLength: 9, required: true }],
  NL: [{ key: 'bsn', label: 'BSN Number *', placeholder: '123456789', keyboard: 'number-pad', maxLength: 9, required: true }],
  PT: [{ key: 'cc', label: 'Cartão de Cidadão *', placeholder: '12345678 9 ZZ4', keyboard: 'default', required: true }],
  IE: [{ key: 'pps', label: 'PPS Number *', placeholder: '1234567T', keyboard: 'default', maxLength: 8, required: true }],
  PL: [{ key: 'pesel', label: 'PESEL Number *', placeholder: '12345678901', keyboard: 'number-pad', maxLength: 11, required: true }],
  SE: [{ key: 'personnummer', label: 'Personnummer *', placeholder: 'YYYYMMDD-XXXX', keyboard: 'default', required: true }],
  CH: [{ key: 'ahv', label: 'AHV Number *', placeholder: '756.1234.5678.90', keyboard: 'default', required: true }],

  // ===== ASIA =====
  IN: [
    { key: 'aadhaar', label: 'Aadhaar (12 digits) *', placeholder: '123456789012', keyboard: 'number-pad', maxLength: 12, required: true },
    { key: 'pan', label: 'PAN Number *', placeholder: 'ABCDE1234F', keyboard: 'default', maxLength: 10, required: true },
  ],
  PK: [{ key: 'cnic', label: 'CNIC Number *', placeholder: '12345-1234567-1', keyboard: 'default', maxLength: 15, required: true }],
  BD: [{ key: 'nid', label: 'National ID *', placeholder: '1234567890', keyboard: 'number-pad', required: true }],
  CN: [{ key: 'resident_id', label: 'Resident ID (18 digits) *', placeholder: '110101199003078515', keyboard: 'default', maxLength: 18, required: true }],
  JP: [{ key: 'my_number', label: 'My Number (12 digits) *', placeholder: '123456789012', keyboard: 'number-pad', maxLength: 12, required: true }],
  KR: [{ key: 'rrn', label: 'RRN (13 digits) *', placeholder: '123456-1234567', keyboard: 'default', maxLength: 14, required: true }],
  PH: [{ key: 'philsys', label: 'PhilSys Number *', placeholder: '1234-5678-9012', keyboard: 'default', required: true }],
  ID: [{ key: 'nik', label: 'NIK (16 digits) *', placeholder: '1234567890123456', keyboard: 'number-pad', maxLength: 16, required: true }],
  VN: [{ key: 'cccd', label: 'CCCD Number *', placeholder: '001234567890', keyboard: 'number-pad', required: true }],
  TH: [{ key: 'national_id', label: 'National ID (13 digits) *', placeholder: '1234567890123', keyboard: 'number-pad', maxLength: 13, required: true }],
  MY: [{ key: 'mykad', label: 'MyKad Number *', placeholder: '123456-12-1234', keyboard: 'default', required: true }],
  SA: [{ key: 'iqama', label: 'Iqama / National ID *', placeholder: '1234567890', keyboard: 'number-pad', required: true }],
  AE: [{ key: 'emirates_id', label: 'Emirates ID *', placeholder: '784-1234-1234567-1', keyboard: 'default', required: true }],
  IL: [{ key: 'teudat_zehut', label: 'Teudat Zehut *', placeholder: '123456789', keyboard: 'number-pad', maxLength: 9, required: true }],
  TR: [{ key: 'tckn', label: 'TC Kimlik No (11 digits) *', placeholder: '12345678901', keyboard: 'number-pad', maxLength: 11, required: true }],

  // ===== SOUTH AMERICA =====
  BR: [{ key: 'cpf', label: 'CPF Number *', placeholder: '123.456.789-01', keyboard: 'default', maxLength: 14, required: true }],
  AR: [{ key: 'dni', label: 'DNI (8 digits) *', placeholder: '12345678', keyboard: 'number-pad', maxLength: 8, required: true }],
  CO: [{ key: 'cedula', label: 'Cédula Number *', placeholder: '1234567890', keyboard: 'number-pad', required: true }],
  CL: [{ key: 'rut', label: 'RUT Number *', placeholder: '12345678-9', keyboard: 'default', required: true }],
  PE: [{ key: 'dni', label: 'DNI (8 digits) *', placeholder: '12345678', keyboard: 'number-pad', maxLength: 8, required: true }],

  // ===== OCEANIA =====
  AU: [{ key: 'tfn', label: 'Tax File Number *', placeholder: '123456789', keyboard: 'number-pad', maxLength: 9, required: true }],
  NZ: [{ key: 'ird', label: 'IRD Number *', placeholder: '123456789', keyboard: 'number-pad', maxLength: 9, required: true }],
};

export const DEFAULT_KYC: KycField[] = [
  { key: 'national_id', label: 'National ID Number *', placeholder: 'Enter your national ID', keyboard: 'default', required: true },
  { key: 'passport', label: 'Passport (optional)', placeholder: 'Optional', keyboard: 'default', required: false },
];

export function getKycFields(countryCode: string): KycField[] {
  const code = (countryCode || 'NG').toUpperCase();
  return KYC_BY_COUNTRY[code] || DEFAULT_KYC;
}
