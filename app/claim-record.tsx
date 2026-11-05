import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/api/supabase';
import { useTheme } from '../src/theme';

export default function ClaimRecord() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [nin, setNin] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const search = async () => {
    if (!nin || nin.length < 11) {
      Alert.alert('Invalid NIN', 'Please enter an 11-digit NIN.');
      return;
    }
    setSearching(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.rpc('preview_staged_farmer', { p_nin: nin });
      if (error) throw error;
      if (!data) {
        Alert.alert('Not Found', 'No unclaimed record found for this NIN.');
      } else {
        setPreview(data);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSearching(false);
    }
  };

  const claim = async () => {
    setClaiming(true);
    try {
      const { data, error } = await supabase.rpc('claim_staged_farmer');
      if (error) throw error;
      if (data.claimed > 0) {
        Alert.alert('Success', 'Your farm record has been successfully linked to your profile!');
        router.replace('/(tabs)');
      } else {
        Alert.alert('Failed', 'Could not claim record. Ensure your profile has the correct NIN.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <Text style={styles.title}>Claim Your Farm</Text>
        <Text style={styles.sub}>
          Were you registered by the Ministry of Agriculture? Enter your NIN to link your existing farm data to GAIA.
        </Text>

        <View style={styles.searchBox}>
          <TextInput
            value={nin}
            onChangeText={setNin}
            keyboardType="number-pad"
            maxLength={11}
            style={styles.input}
            placeholder="11-digit NIN"
            placeholderTextColor="#888"
          />
          <Pressable onPress={search} disabled={searching} style={styles.searchBtn}>
            {searching ? <ActivityIndicator color="#000" /> : <Text style={styles.searchBtnTxt}>SEARCH</Text>}
          </Pressable>
        </View>

        {preview ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Record Found ✅</Text>
            <Text style={styles.resultName}>{preview.full_name || 'Unknown Name'}</Text>
            
            <View style={styles.row}>
              <Text style={styles.k}>State</Text>
              <Text style={styles.v}>{preview.state || '—'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>LGA</Text>
              <Text style={styles.v}>{preview.lga || '—'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>Ward</Text>
              <Text style={styles.v}>{preview.ward || '—'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>Primary Crop</Text>
              <Text style={styles.v}>{preview.crop || '—'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>Farm Size</Text>
              <Text style={styles.v}>{preview.farm_size_acres ? preview.farm_size_acres + ' acres' : '—'}</Text>
            </View>

            <Pressable onPress={claim} disabled={claiming} style={styles.cta}>
              {claiming ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>CLAIM THIS RECORD</Text>}
            </Pressable>
          </View>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 6, marginBottom: 24, lineHeight: 20 },
  searchBox: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 16 },
  searchBtn: { paddingHorizontal: 20, justifyContent: 'center', backgroundColor: p.neon, borderRadius: 12 },
  searchBtnTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
  resultCard: { marginTop: 24, padding: 20, borderRadius: 16, backgroundColor: 'rgba(0,255,136,0.05)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)' },
  resultTitle: { fontSize: 14, fontWeight: '900', color: p.neon, marginBottom: 4 },
  resultName: { fontSize: 22, fontWeight: '900', color: p.text, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  k: { fontSize: 13, color: p.textMuted },
  v: { fontSize: 13, fontWeight: '700', color: p.text },
  cta: { marginTop: 24, padding: 18, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
