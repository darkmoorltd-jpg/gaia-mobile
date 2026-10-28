import React from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { useTheme } from '../theme';
import Dropdown from './Dropdown';
import { COUNTRY_BY_CODE, CountryMeta } from '../data/countries_full';
import { getPrimaryOptions as getLocalPrimary, getSecondaryOptions, hasPrimarySubdivisions } from '../data/subdivisions';
import { isoPrimaryOptions } from '../data/iso_subdivisions';

// Combined: local (NG/GH/KE with LGA-level) wins, else global ISO 3166-2
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
  countryLocked?: boolean;         // true in profile, false in signup
  primary: string;                 // state / region / province
  secondary: string;               // LGA / district / constituency
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
}: Props) {
  const { palette } = useTheme();
  const s = createStyles(palette);

  const meta: CountryMeta | undefined = COUNTRY_BY_CODE[countryCode];
  const countryName = meta?.name || countryCode || 'Not selected';
  const primaryLabel = meta?.primaryLabel || 'State / Region';
  const secondaryLabel = meta?.secondaryLabel || 'LGA / District';

  const primaryOptions = getPrimaryOptions(countryCode);
  const secondaryOptions = primary ? getSecondaryOptions(countryCode, primary) : [];
  const hasData = hasCascadeData(countryCode);
  const hasSecondaryData = secondaryOptions.length > 0;

  return (
    <View>
      {/* Country — locked pill in profile mode, dropdown in signup mode */}
      {countryLocked ? (
        <View>
          <Text style={s.label}>COUNTRY</Text>
          <View style={s.lockedPill}>
            <Text style={s.lockedText}>{countryName}</Text>
            <Text style={s.lockedNote}>locked at signup</Text>
          </View>
        </View>
      ) : null}

      {/* Primary subdivision */}
      {hasData ? (
        <Dropdown
          label={primaryLabel.toUpperCase()}
          value={primary}
          options={primaryOptions}
          onChange={(v) => onChange({ primary: v, secondary: '' })}
          placeholder={`Select ${primaryLabel.toLowerCase()}`}
        />
      ) : (
        <View>
          <Text style={s.label}>{primaryLabel.toUpperCase()}</Text>
          <TextInput
            value={primary}
            onChangeText={(v) => onChange({ primary: v })}
            placeholder={`Enter ${primaryLabel.toLowerCase()}`}
            placeholderTextColor={palette.textDim}
            style={s.input}
          />
        </View>
      )}

      {/* Secondary subdivision */}
      {hasSecondaryData ? (
        <Dropdown
          label={secondaryLabel.toUpperCase()}
          value={secondary}
          options={secondaryOptions}
          onChange={(v) => onChange({ secondary: v })}
          placeholder={primary ? `Select ${secondaryLabel.toLowerCase()}` : `Pick ${primaryLabel.toLowerCase()} first`}
        />
      ) : (
        <View>
          <Text style={s.label}>{secondaryLabel.toUpperCase()}</Text>
          <TextInput
            value={secondary}
            onChangeText={(v) => onChange({ secondary: v })}
            placeholder={`Enter ${secondaryLabel.toLowerCase()}`}
            placeholderTextColor={palette.textDim}
            style={s.input}
          />
        </View>
      )}

      {/* City */}
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

      {/* Ward */}
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
});
