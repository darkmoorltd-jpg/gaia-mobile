import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Linking } from 'react-native';
import { useTheme, spacing, typography, radius } from '../src/theme';
import { Pill, GlassCard, NeonButton } from '../src/components';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

// Sponsor ad shown to farmers — agro-input companies pay to display
export default function SponsoredAds() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [ads, setAds] = useState<any[]>([]);
  const [myAds, setMyAds] = useState<any[]>([]);
  const [tab, setTab] = useState<'browse' | 'mine' | 'create'>('browse');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('advertisements').select('*').eq('status', 'active').limit(20);
    setAds(data || []);

    if (user) {
      const { data: mine } = await supabase.from('advertisements').select('*').eq('advertiser_id', user.id);
      setMyAds(mine || []);
    }
  };

  const trackClick = async (ad: any) => {
    await supabase.from('ad_clicks').insert({ ad_id: ad.id, user_id: user?.id });
    Linking.openURL(ad.link_url);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Sponsored" color={palette.warning} />
        <Text style={styles.title}>Advertisements</Text>
        <Text style={styles.subtitle}>Agro-inputs, seeds, fertilizers from trusted partners</Text>

        <View style={styles.tabs}>
          {(['browse', 'mine', 'create'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'browse' ? (
          <>
            {ads.length === 0 ? (
              <GlassCard><Text style={styles.empty}>No ads right now</Text></GlassCard>
            ) : ads.map((ad) => (
              <Pressable key={ad.id} onPress={() => trackClick(ad)} style={styles.adCard}>
                {ad.image_url ? <Image source={{ uri: ad.image_url }} style={styles.adImg} /> : null}
                <View style={styles.adBody}>
                  <View style={styles.sponsored}>
                    <Text style={styles.sponsoredText}>SPONSORED</Text>
                  </View>
                  <Text style={styles.adTitle}>{ad.title}</Text>
                  <Text style={styles.adCopy}>{ad.body}</Text>
                  <Text style={styles.adCta}>{ad.cta || 'Learn more'} →</Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}

        {tab === 'mine' ? (
          <>
            <Text style={styles.section}>YOUR CAMPAIGNS ({myAds.length})</Text>
            {myAds.map((ad) => (
              <GlassCard key={ad.id} style={{ marginBottom: 10 }}>
                <Text style={styles.adTitle}>{ad.title}</Text>
                <Text style={styles.adStatus}>{ad.status}</Text>
              </GlassCard>
            ))}
            {myAds.length === 0 ? <Text style={styles.empty}>No campaigns yet</Text> : null}
          </>
        ) : null}

        {tab === 'create' ? (
          <CreateAdForm palette={palette} onCreated={load} />
        ) : null}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function CreateAdForm({ palette, onCreated }: any) {
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !url.trim() || !user) return;
    setBusy(true);
    await supabase.from('advertisements').insert({
      advertiser_id: user.id,
      title, body, link_url: url, status: 'pending',
    });
    setTitle(''); setBody(''); setUrl('');
    setBusy(false);
    onCreated?.();
  };

  return (
    <GlassCard>
      <Text style={styles.adTitle}>New Campaign</Text>
      <Text style={styles.label}>TITLE</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="e.g., Premium NPK Fertilizer" placeholderTextColor={palette.textDim} />

      <Text style={styles.label}>DESCRIPTION</Text>
      <TextInput value={body} onChangeText={setBody} multiline style={[styles.input, { minHeight: 80 }]} placeholder="Short pitch" placeholderTextColor={palette.textDim} />

      <Text style={styles.label}>LINK</Text>
      <TextInput value={url} onChangeText={setUrl} style={styles.input} placeholder="https://..." placeholderTextColor={palette.textDim} autoCapitalize="none" keyboardType="url" />

      <NeonButton label={busy ? '' : 'SUBMIT FOR REVIEW'} onPress={submit} style={{ marginTop: 14 }} />

      <Text style={styles.hint}>Ads are reviewed within 24 hours. Cost: ₦20,000 per 1,000 impressions.</Text>
    </GlassCard>
  );
}

import { TextInput } from 'react-native';

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8 },
  subtitle: { ...typography.body, color: p.textMuted, marginTop: 6 },
  tabs: { flexDirection: 'row', gap: 6, marginTop: 16, marginBottom: 20 },
  tab: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabActive: { backgroundColor: p.warning, borderColor: p.warning },
  tabText: { fontSize: 10, fontWeight: '800', color: p.textMuted },
  tabTextActive: { color: p.obsidian },
  empty: { color: p.textMuted, textAlign: 'center', paddingVertical: 30 },
  section: { ...typography.micro, color: p.textMuted, marginBottom: 12 },
  adCard: {
    backgroundColor: p.surface, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: p.border, marginBottom: 14,
  },
  adImg: { width: '100%', height: 140 },
  adBody: { padding: 16 },
  sponsored: {
    backgroundColor: 'rgba(255,180,50,0.15)', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, alignSelf: 'flex-start', marginBottom: 8,
  },
  sponsoredText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: p.warning },
  adTitle: { fontSize: 17, fontWeight: '900', color: p.text },
  adCopy: { fontSize: 13, color: p.textMuted, marginTop: 6, lineHeight: 18 },
  adCta: { fontSize: 13, fontWeight: '800', color: p.warning, marginTop: 10 },
  adStatus: { fontSize: 11, fontWeight: '700', color: p.neon, marginTop: 6, textTransform: 'uppercase' },
  label: { ...typography.micro, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  input: {
    padding: 12, borderRadius: 12, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14,
    textAlignVertical: 'top',
  },
  hint: { fontSize: 11, color: p.textDim, marginTop: 10, lineHeight: 16 },
});
