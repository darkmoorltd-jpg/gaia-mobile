import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { useTheme } from '../theme';
import Dropdown from './Dropdown';
import { COUNTRY_BY_CODE, COUNTRIES_FULL, CountryMeta } from '../data/countries_full';
import { getPrimaryOptions as getLocalPrimary, getSecondaryOptions } from '../data/subdivisions';
import { isoPrimaryOptions } from '../data/iso_subdivisions';

// Build name→code map once
const NAME_TO_CODE: Record<string, string> = COUNTRIES_FULL.reduce((acc, c) => {
  acc[c.name.toLowerCase()] = c.code;
  return acc;
}, {} as Record<string, string>);

function normalizeCountryCode(input: string): string {
  if (!input) return 'NG';
  const trimmed = input.trim();
  if (trimmed.length === 2 && /^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  const lower = trimmed.toLowerCase();
  if (NAME_TO_CODE[lower]) return NAME_TO_CODE[lower];
  const m = trimmed.match(/\b([A-Za-z]{2})\b/);
  if (m) return m[1].toUpperCase();
  return 'NG';
}

function getPrimaryOptions(countryCode: string): string[] {
  const local = getLocalPrimary(countryCode);
  if (local.length > 0) return local;
  return isoPrimaryOptions(countryCode);
}

function hasCascadeData(countryCode: string): boolean {
  return getPrimaryOptions(countryCode).length > 0;
}

interface Props {
  countryCode: string;
  countryLocked?: boolean;
  primary: string;
  secondary: string;
  city: string;
  ward?: string;
  onChange: (updates: {
    primary?: string;
    secondary?: string;
    city?: string;
    ward?: string;
  }) => void;
  showWard?: boolean;
  showCity?: boolean;
  debug?: boolean;
}

export default function LocationCascade({
  countryCode,
  countryLocked = false,
  primary,
  secondary,
  city,
  ward = '',
  onChange,
  showWard = false,
  showCity = true,
  debug = false,
}: Props) {
  const { palette } = useTheme();
  const s = createStyles(palette);

  const code = normalizeCountryCode(countryCode);
  const meta: CountryMeta | undefined = COUNTRY_BY_CODE[code];
  const countryName = meta?.name || code || 'Not selected';
  const primaryLabel = meta?.primaryLabel || 'State / Region';
  const secondaryLabel = meta?.secondaryLabel || 'LGA / District';

  const primaryOptions = getPrimaryOptions(code);
  const secondaryOptions = primary ? getSecondaryOptions(code, primary) : [];
  const hasData = hasCascadeData(code);
  const hasSecondaryData = secondaryOptions.length > 0;

  return (
    <View>
      {debug ? (
        <View style={s.debugBox}>
          <Text style={s.debugText}>code={code} hasData={String(hasData)} prim={primaryOptions.length} sec={secondaryOptions.length}</Text>
          <Text style={s.debugText}>input="{countryCode || '(empty)'}" primary="{primary || '(empty)'}"</Text>
        </View>
      ) : null}

      {countryLocked ? (
        <View>
          <Text style={s.label}>COUNTRY</Text>
          <View style={s.lockedPill}>
            <Text style={s.lockedText}>{countryName}</Text>
            <Text style={s.lockedNote}>locked at signup</Text>
          </View>
        </View>
      ) : null}

      {hasData ? (
        <Dropdown
          label={primaryLabel.toUpperCase()}
          value={primary}
          options={primaryOptions}
          onChange={(v) => onChange({ primary: v, secondary: '' })}
          placeholder={'Select ' + primaryLabel.toLowerCase()}
        />
      ) : (
        <View>
          <Text style={s.label}>{primaryLabel.toUpperCase()}</Text>
          <TextInput
            value={primary}
            onChangeText={(v) => onChange({ primary: v })}
            placeholder={'Enter ' + primaryLabel.toLowerCase()}
            placeholderTextColor={palette.textDim}
            style={s.input}
          />
        </View>
      )}

      {hasSecondaryData ? (
        <Dropdown
          label={secondaryLabel.toUpperCase()}
          value={secondary}
          options={secondaryOptions}
          onChange={(v) => onChange({ secondary: v })}
          placeholder={primary ? 'Select ' + secondaryLabel.toLowerCase() : 'Pick ' + primaryLabel.toLowerCase() + ' first'}
        />
      ) : (
        <View>
          <Text style={s.label}>{secondaryLabel.toUpperCase()}</Text>
          <TextInput
            value={secondary}
            onChangeText={(v) => onChange({ secondary: v })}
            placeholder={'Enter ' + secondaryLabel.toLowerCase()}
            placeholderTextColor={palette.textDim}
            style={s.input}
          />
        </View>
      )}

      {showCity ? (
        <View>
          <Text style={s.label}>CITY / TOWN</Text>
          <TextInput
            value={city}
            onChangeText={(v) => onChange({ city: v })}
            placeholder="Enter city or town"
            placeholderTextColor={palette.textDim}
            style={s.input}
          />
        </View>
      ) : null}

      {showWard ? (
        <View>
          <Text style={s.label}>WARD</Text>
          <TextInput
            value={ward}
            onChangeText={(v) => onChange({ ward: v })}
            placeholder="Enter ward"
            placeholderTextColor={palette.textDim}
            style={s.input}
          />
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  lockedPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12,
    backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)',
  },
  lockedText: { fontSize: 15, fontWeight: '700', color: p.text },
  lockedNote: { fontSize: 10, color: p.textDim, fontStyle: 'italic' },
  debugBox: {
    padding: 8, borderRadius: 6, backgroundColor: 'rgba(255,59,92,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,59,92,0.4)', marginBottom: 8,
  },
  debugText: { fontSize: 9, color: '#ff3b5c', fontFamily: 'monospace', lineHeight: 12 },
});
