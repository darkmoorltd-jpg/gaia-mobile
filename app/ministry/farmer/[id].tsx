import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../src/theme';
import { supabase } from '../../../src/api/supabase';

export default function MinistryFarmerDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('ministry_farmer_full_profile', { p_farmer_id: id });
    if (error) {
      console.error('profile load error:', error);
    } else {
      setProfile(data);
    }
    setBusy(false);
  }, [id]);

  const refresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (busy && !profile) return <View style={styles.center}><ActivityIndicator color={palette.neon} size="large" /></View>;
  if (!profile) return <View style={styles.center}><Text style={{ color: '#ff3b5c', fontWeight: '900' }}>Farmer not found or access denied</Text></View>;

  const idn = profile.identity || {};
  const loc = profile.location || {};
  const farm = profile.farm || {};
  const poly = profile.polygon || {};
  const ndvi = profile.ndvi || {};
  const bank = profile.banking || {};
  const demo = profile.demographics || {};
  const fin = profile.financial || {};
  const coop = profile.cooperative || {};
  const mkt = profile.market || {};
  const inp = profile.inputs || {};
  const assets = profile.assets || {};
  const agent = profile.agent || {};
  const verif = profile.verification || {};
  const scans = profile.scans || {};
  const scanHistory = scans.history || [];

  const row = (k: string, v: any, mono = false) => (
    <View style={styles.kvRow} key={k}>
      <Text style={styles.kvK}>{k}</Text>
      <Text style={[styles.kvV, mono && { fontFamily: 'monospace' }]}>{v ?? '—'}</Text>
    </View>
  );

  const section = (title: string, children: React.ReactNode) => (
    <View key={title}>
      <Text style={styles.sectionLbl}>{title}</Text>
      <View style={styles.block}>{children}</View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.title} numberOfLines={1}>{idn.full_name || 'Farmer'}</Text>
          {idn.nin_verified ? <Text style={{ fontSize: 20 }}>✅</Text> : null}
        </View>
        <Text style={styles.sub}>{[loc.state, loc.lga, loc.ward].filter(Boolean).join(' · ') || 'No location'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}>

        {section('IDENTITY', <>
          {row('Farmer ID', idn.unique_farmer_id, true)}
          {row('Full name', idn.full_name)}
          {row('Phone', idn.phone)}
          {row('Date of birth', idn.date_of_birth)}
          {row('Age', idn.age ? `${idn.age} years` : '—')}
          {row('Sex', idn.sex)}
          {row('NIN', idn.nin, true)}
          {row('NIN verified', idn.nin_verified ? '✅ Yes' : '⏳ No')}
          {row('BVN', idn.bvn, true)}
          {row('KYC status', idn.kyc_status)}
        </>)}

        {section('LOCATION', <>
          {row('State', loc.state)}
          {row('LGA', loc.lga)}
          {row('Ward', loc.ward)}
          {row('Community', loc.community)}
          {row('GPS', loc.gps_lat ? `${loc.gps_lat}, ${loc.gps_lon}` : '—', true)}
          {loc.gps_lat ? (
            <Pressable onPress={() => Linking.openURL(`https://maps.google.com/?q=${loc.gps_lat},${loc.gps_lon}`)} style={styles.actionBtn}>
              <Text style={styles.actionTxt}>OPEN IN MAPS</Text>
            </Pressable>
          ) : null}
        </>)}

        {section('FARM', <>
          {row('Primary crops', farm.primary_crops)}
          {row('Category', farm.category)}
          {row('Subcategory', farm.subcategory)}
          {row('Size (acres)', farm.farm_size_acres)}
          {row('Size (hectares)', farm.land_area_hectares)}
          {row('Scale', farm.farm_size_scale)}
          {row('Land tenure', farm.land_tenure)}
          {row('Title type', farm.title_type)}
          {row('Title number', farm.title_number)}
          {row('Farming start', farm.farming_start_year)}
          {row('Season', farm.farming_season)}
          {row('Practices', Array.isArray(farm.farming_practices) ? farm.farming_practices.join(', ') : '—')}
          {row('Current season', farm.current_season)}
          {row('Expected yield', farm.expected_yield_kg ? `${farm.expected_yield_kg} kg` : '—')}
          {row('Last harvest', farm.last_harvest_yield_kg ? `${farm.last_harvest_yield_kg} kg` : '—')}
        </>)}

        {poly.geojson ? section('SURVEY PLAN / POLYGON', <>
          {row('Area', poly.area_hectares ? `${poly.area_hectares} ha` : '—')}
          {row('Centroid', poly.centroid_lat ? `${poly.centroid_lat}, ${poly.centroid_lon}` : '—', true)}
          {row('GeoJSON vertices', Array.isArray(poly.geojson?.coordinates?.[0]) ? `${poly.geojson.coordinates[0].length} vertices` : '—')}
          {poly.centroid_lat ? (
            <Pressable onPress={() => Linking.openURL(`https://maps.google.com/?q=${poly.centroid_lat},${poly.centroid_lon}`)} style={styles.actionBtn}>
              <Text style={styles.actionTxt}>VIEW BOUNDARY ON MAP</Text>
            </Pressable>
          ) : null}
        </>) : null}

        {ndvi.latest ? section('SATELLITE / NDVI', <>
          {row('Latest NDVI', ndvi.latest?.toFixed(3))}
          {row('Health', ndvi.health?.toUpperCase())}
          {row('As of', ndvi.at ? new Date(ndvi.at).toLocaleDateString() : '—')}
          {row('Satellite verified', ndvi.satellite_verified ? '✅ Yes' : '⏳ No')}
          {row('Deforestation flag', ndvi.deforestation_flag ? '⚠️ FLAGGED' : '✅ Clear')}
        </>) : null}

        {section(`SCAN HISTORY (${scanHistory.length})`, <>
          <View style={styles.scanGrid}>
            <View style={styles.scanTile}>
              <Text style={styles.scanNum}>{scans.crop_count || 0}</Text>
              <Text style={styles.scanLbl}>CROP</Text>
            </View>
            <View style={styles.scanTile}>
              <Text style={styles.scanNum}>{scans.pest_count || 0}</Text>
              <Text style={styles.scanLbl}>PEST</Text>
            </View>
            <View style={styles.scanTile}>
              <Text style={styles.scanNum}>{scans.soil_count || 0}</Text>
              <Text style={styles.scanLbl}>SOIL</Text>
            </View>
            <View style={styles.scanTile}>
              <Text style={styles.scanNum}>{scans.livestock_count || 0}</Text>
              <Text style={styles.scanLbl}>LIVESTOCK</Text>
            </View>
          </View>
          {scans.last_scan_at ? <Text style={styles.hint}>Last scan: {new Date(scans.last_scan_at).toLocaleString()}</Text> : null}

          {scanHistory.length === 0 ? <Text style={styles.empty}>No scans yet.</Text> : null}
          {scanHistory.slice(0, 20).map((s: any, i: number) => (
            <View key={i} style={styles.scanRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.scanType}>{String(s.scan_type || 'scan').toUpperCase()}</Text>
                {s.subject ? <Text style={styles.scanSubject}>{s.subject}</Text> : null}
                {s.result ? <Text style={styles.scanResult} numberOfLines={2}>{s.result}</Text> : null}
                {s.confidence ? <Text style={styles.scanConf}>Confidence: {(s.confidence * 100).toFixed(0)}%</Text> : null}
                <Text style={styles.scanDate}>{new Date(s.created_at).toLocaleString()}</Text>
              </View>
              {s.image_url ? (
                <Pressable onPress={() => Linking.openURL(s.image_url)} style={styles.scanImg}>
                  <Text style={styles.scanImgTxt}>📷</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {scanHistory.length > 20 ? <Text style={styles.hint}>Showing 20 of {scanHistory.length}</Text> : null}
        </>)}

        {section('BANK', <>
          {row('Bank', bank.bank_name)}
          {row('Account name', bank.account_name)}
          {row('Account #', bank.account_number, true)}
        </>)}

        {section('DEMOGRAPHICS', <>
          {row('Household size', demo.household_size)}
          {row('Literacy', demo.literacy_level === 3 ? 'Literate' : demo.literacy_level === 2 ? 'Semi-literate' : demo.literacy_level === 1 ? 'Illiterate' : '—')}
          {row('Education', demo.education_level === 3 ? 'Tertiary' : demo.education_level === 2 ? 'Secondary' : demo.education_level === 1 ? 'Primary' : demo.education_level === 0 ? 'None' : '—')}
          {row('Youth (<35)', demo.youth ? 'Yes' : 'No')}
          {row('Disability', demo.disability)}
          {row('Vulnerability', Array.isArray(demo.vulnerability_status) ? demo.vulnerability_status.join(', ') : '—')}
        </>)}

        {section('FINANCIAL', <>
          {row('Credit access', fin.has_credit_access ? '✅ Yes' : 'No')}
          {row('Insurance', fin.has_insurance ? `✅ ${fin.insurance_provider || 'Yes'}` : 'No')}
          {row('Subsidy received', fin.received_subsidy ? '✅ Yes' : 'No')}
          {row('Other income', fin.other_income_source)}
        </>)}

        {coop.is_member ? section('COOPERATIVE', <>
          {row('Coop name', coop.coop_name)}
          {row('Role', coop.coop_role)}
          {row('Joined', coop.joined_year)}
        </>) : null}

        {section('MARKET ACCESS', <>
          {row('Sells to', Array.isArray(mkt.sells_to) ? mkt.sells_to.join(', ') : '—')}
          {row('Contract farming', mkt.has_contract_farming ? `✅ ${mkt.contract_buyer || ''}` : 'No')}
        </>)}

        {section('INPUTS', <>
          {row('Fertilizer', inp.fertilizer_brand)}
          {row('Kg/season', inp.fertilizer_kg)}
          {row('Seed source', inp.seed_source)}
          {row('Pesticides', inp.pesticide_usage)}
        </>)}

        {section('ASSETS', <>
          {row('Equipment', Array.isArray(assets.farm_assets) ? assets.farm_assets.join(', ') : '—')}
          {row('Water source', assets.water_source)}
          {row('Storage', assets.storage_type)}
        </>)}

        {section('VERIFICATION', <>
          {row('Status', verif.status)}
          {row('ID type', verif.id_type)}
          {row('Submitted', verif.submitted_at ? new Date(verif.submitted_at).toLocaleDateString() : '—')}
          {verif.id_image_url ? (
            <Pressable onPress={() => Linking.openURL(verif.id_image_url)} style={styles.actionBtn}>
              <Text style={styles.actionTxt}>VIEW ID DOCUMENT</Text>
            </Pressable>
          ) : null}
          {verif.selfie_url ? (
            <Pressable onPress={() => Linking.openURL(verif.selfie_url)} style={styles.actionBtn}>
              <Text style={styles.actionTxt}>VIEW SELFIE</Text>
            </Pressable>
          ) : null}
        </>)}

        {section('AGENT PROVENANCE', <>
          {row('Agent name', agent.agent_name)}
          {row('Agent phone', agent.agent_phone)}
          {row('Registered', agent.registered_at ? new Date(agent.registered_at).toLocaleString() : '—')}
        </>)}

        {(profile.batches || []).length > 0 ? section(`BATCHES (${profile.batches.length})`, <>
          {profile.batches.map((b: any, i: number) => (
            <View key={i} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{b.batch_code} — {b.crop_name}</Text>
                <Text style={styles.listMeta}>{b.quantity_kg} kg · {b.status}</Text>
              </View>
            </View>
          ))}
        </>) : null}

        {(profile.listings || []).length > 0 ? section(`MARKETPLACE LISTINGS (${profile.listings.length})`, <>
          {profile.listings.map((l: any, i: number) => (
            <View key={i} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{l.title}</Text>
                <Text style={styles.listMeta}>₦{Number(l.price).toLocaleString()}/{l.unit} · Qty {l.quantity} · {l.approval_status}</Text>
              </View>
            </View>
          ))}
        </>) : null}

        {(profile.loans || []).length > 0 ? section(`LOANS (${profile.loans.length})`, <>
          {profile.loans.map((l: any, i: number) => (
            <View key={i} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>₦{Number(l.amount).toLocaleString()}</Text>
                <Text style={styles.listMeta}>{l.status} · {new Date(l.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
          ))}
        </>) : null}

        {(profile.certifications || []).length > 0 ? section(`CERTIFICATIONS (${profile.certifications.length})`, <>
          {profile.certifications.map((c: any, i: number) => (
            <View key={i} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{c.certificate_code}</Text>
                <Text style={styles.listMeta}>Expires {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</Text>
              </View>
            </View>
          ))}
        </>) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian, padding: 20 },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: p.text, flex: 1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  sectionLbl: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 20, marginBottom: 8 },
  block: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  kvRow: { flexDirection: 'row', paddingVertical: 6, alignItems: 'flex-start' },
  kvK: { fontSize: 12, color: '#888', width: 130 },
  kvV: { flex: 1, fontSize: 13, color: p.text, fontWeight: '600' },
  actionBtn: { marginTop: 10, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: p.neon, alignItems: 'center' },
  actionTxt: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  hint: { fontSize: 11, color: p.textMuted, fontStyle: 'italic', marginTop: 6 },
  empty: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', marginTop: 8 },
  scanGrid: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  scanTile: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)', alignItems: 'center' },
  scanNum: { fontSize: 22, fontWeight: '900', color: p.neon },
  scanLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, marginTop: 2, letterSpacing: 0.5 },
  scanRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  scanType: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  scanSubject: { fontSize: 12, color: p.text, marginTop: 2, fontWeight: '700' },
  scanResult: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  scanConf: { fontSize: 10, color: p.textDim, marginTop: 2 },
  scanDate: { fontSize: 10, color: p.textDim, marginTop: 4 },
  scanImg: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(0,255,136,0.1)', alignItems: 'center', justifyContent: 'center' },
  scanImgTxt: { fontSize: 16 },
  listRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  listTitle: { fontSize: 13, fontWeight: '700', color: p.text },
  listMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
});
