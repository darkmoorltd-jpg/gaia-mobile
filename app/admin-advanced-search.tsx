import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Modal, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { useIsAdmin } from '../src/utils/admin';
import { supabase } from '../src/api/supabase';
function fmt(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return String(s); }
}

export default function AdminAdvancedSearch() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const { isAdmin, isSuperAdmin } = useIsAdmin();

  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [tab, setTab] = useState<'profile' | 'timeline' | 'payments' | 'activity' | 'market' | 'ops'>('profile');
  const [detailBusy, setDetailBusy] = useState(false);

  const search = useCallback(async () => {
    if (query.trim().length < 2) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_search_users', { p_query: query.trim() });
      if (error) setResults([]); else setResults(data || []);
    } catch { setResults([]); }
    setBusy(false);
  }, [query]);

  const openUser = async (u: any) => {
    setSelected(u);
    setDetail(null); setTimeline([]);
    setTab('profile');
    setDetailBusy(true);
    try {
      const [d, t] = await Promise.all([
        supabase.rpc('admin_user_full_profile', { p_user_id: u.user_id }),
        supabase.rpc('admin_user_activity_timeline', { p_user_id: u.user_id }),
      ]);
      if (!d.error) setDetail(d.data);
      if (!t.error) setTimeline(t.data || []);
    } catch {}
    setDetailBusy(false);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const p = detail?.profile || {};
  const a = detail?.auth || {};

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Advanced Search</Text>
        <Text style={styles.sub}>Search by name, email, phone, BVN, NIN, state, LGA, DOB…</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. Ibrahim, 0803, 12345678901, Kaduna"
            placeholderTextColor={palette.textDim}
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            autoCapitalize="none"
            onSubmitEditing={search}
          />
          <Pressable onPress={search} style={styles.searchBtn}>
            <Text style={styles.searchBtnText}>SEARCH</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {results.length > 0 ? <Text style={styles.sub}>{results.length} result(s)</Text> : null}

        {results.map((u, i) => (
          <Pressable key={i} onPress={() => openUser(u)} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{(u.name || u.email || 'U').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName} numberOfLines={1}>{u.name || u.email}</Text>
              <Text style={styles.cardMeta} numberOfLines={1}>{u.email}</Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {u.phone || '—'} · {u.state || '—'}{u.lga ? ' / ' + u.lga : ''}
              </Text>
              {u.bvn || u.nin ? (
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {u.bvn ? 'BVN ' + u.bvn : ''}{u.bvn && u.nin ? ' · ' : ''}{u.nin ? 'NIN ' + u.nin : ''}
                </Text>
              ) : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

        {!busy && query.length >= 2 && results.length === 0 ? (
          <Text style={styles.empty}>No matching users.</Text>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title} numberOfLines={1}>{selected?.name || selected?.email}</Text>
            <Text style={styles.sub}>{selected?.email}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarInner}>
              {(['profile','timeline','payments','activity','market','ops'] as const).map((t) => (
                <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnOn]}>
                  <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t.toUpperCase()}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {detailBusy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

            <ScrollView style={{ maxHeight: '78%' }}>
              {tab === 'profile' && detail ? (
                <>
                  <Section title="AUTH" styles={styles}>
                    <KV k="Email" v={a.email} styles={styles} />
                    <KV k="Signup" v={fmt(a.created_at)} styles={styles} />
                    <KV k="Email confirmed" v={fmt(a.email_confirmed_at)} styles={styles} />
                    <KV k="Last sign-in" v={fmt(a.last_sign_in_at)} styles={styles} />
                    <KV k="Role" v={a.role} styles={styles} />
                  </Section>
                  <Section title="PERSONAL" styles={styles}>
                    <KV k="Name" v={[p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')} styles={styles} />
                    <KV k="Username" v={p.username} styles={styles} />
                    <KV k="Gender" v={p.gender} styles={styles} />
                    <KV k="DOB" v={p.date_of_birth} styles={styles} />
                    <KV k="Marital" v={p.marital_status} styles={styles} />
                    <KV k="Phone" v={p.phone} styles={styles} />
                    <KV k="WhatsApp" v={p.whatsapp} styles={styles} />
                  </Section>
                  <Section title="ADDRESS" styles={styles}>
                    <KV k="Country" v={p.country} styles={styles} />
                    <KV k="State" v={p.state} styles={styles} />
                    <KV k="LGA" v={p.lga} styles={styles} />
                    <KV k="City" v={p.city} styles={styles} />
                    <KV k="Street" v={p.street_address} styles={styles} />
                    <KV k="Landmark" v={p.landmark} styles={styles} />
                    <KV k="Postal" v={p.postal_code} styles={styles} />
                  </Section>
                  <Section title="KYC" styles={styles}>
                    <KV k="BVN" v={p.bvn} styles={styles} />
                    <KV k="NIN" v={p.nin} styles={styles} />
                    <KV k="ID type" v={p.govt_id_type} styles={styles} />
                    <KV k="ID number" v={p.govt_id_number} styles={styles} />
                    <KV k="Status" v={p.verification_status} styles={styles} />
                    <KV k="KYC level" v={p.kyc_level} styles={styles} />
                  </Section>
                  <Section title="FARM" styles={styles}>
                    <KV k="Farm state" v={p.farm_state} styles={styles} />
                    <KV k="Farm LGA" v={p.farm_lga} styles={styles} />
                    <KV k="Farm address" v={p.farm_address} styles={styles} />
                    <KV k="Farm size" v={p.farm_size_acres ? p.farm_size_acres + ' ac' : null} styles={styles} />
                    <KV k="Type" v={p.farming_type} styles={styles} />
                    <KV k="Experience" v={p.years_experience ? p.years_experience + ' yrs' : null} styles={styles} />
                    <KV k="Primary crops" v={p.primary_crops} styles={styles} />
                  </Section>
                  <Section title="BANK" styles={styles}>
                    <KV k="Bank" v={p.bank_name} styles={styles} />
                    <KV k="Account #" v={p.account_number} styles={styles} />
                    <KV k="Account name" v={p.account_name} styles={styles} />
                  </Section>
                  <Section title="STATUS" styles={styles}>
                    <KV k="Account" v={p.account_status} styles={styles} />
                    <KV k="Banned until" v={p.banned_until ? fmt(p.banned_until) : null} styles={styles} />
                    <KV k="Ban reason" v={p.banned_reason} styles={styles} />
                    <KV k="Trust score" v={p.trust_score} styles={styles} />
                    <KV k="Risk score" v={p.risk_score} styles={styles} />
                  </Section>
                  <Section title="STATS" styles={styles}>
                    <KV k="Scans left" v={detail?.scans?.scans_remaining} styles={styles} />
                    <KV k="Plan" v={detail?.scans?.plan} styles={styles} />
                    <KV k="Plan expiry" v={fmt(detail?.scans?.plan_expiry)} styles={styles} />
                    <KV k="Wallet" v={'N' + Number(detail?.wallet?.balance || 0).toLocaleString()} styles={styles} />
                    <KV k="Virtual acct" v={detail?.wallet?.virtual_account} styles={styles} />
                    <KV k="Crops diagnosed" v={p.crops_diagnosed} styles={styles} />
                    <KV k="Pests identified" v={p.pests_identified} styles={styles} />
                    <KV k="Total scans used" v={p.total_scans_used} styles={styles} />
                    <KV k="Listings created" v={p.listings_created} styles={styles} />
                    <KV k="Purchases" v={p.purchases_made} styles={styles} />
                  </Section>
                  {detail?.agent ? (
                    <Section title="AGENT" styles={styles}>
                      <KV k="Code" v={detail.agent.agent_code} styles={styles} />
                      <KV k="Zone" v={detail.agent.agent_zone} styles={styles} />
                      <KV k="Organization" v={detail.agent.agent_organization} styles={styles} />
                      <KV k="Status" v={detail.agent.status} styles={styles} />
                      <KV k="Since" v={fmt(detail.agent.created_at)} styles={styles} />
                    </Section>
                  ) : null}
                </>
              ) : null}

              {tab === 'timeline' ? (
                <>
                  <Section title={'ACTIVITY TIMELINE (' + timeline.length + ')'} styles={styles}>
                    {timeline.length === 0 ? <Text style={styles.kv}>No activity.</Text> :
                      timeline.map((t: any, i: number) => (
                        <View key={i} style={styles.timelineRow}>
                          <View style={[styles.dot, { backgroundColor: dotColor(t.kind, palette) }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.tlTitle}>{t.title}</Text>
                            {t.detail ? <Text style={styles.tlDetail}>{t.detail}</Text> : null}
                            <Text style={styles.tlAt}>{fmt(t.at)}</Text>
                          </View>
                        </View>
                      ))
                    }
                  </Section>
                </>
              ) : null}

              {tab === 'payments' && detail ? (
                <Section title={'PAYMENTS (' + (detail.payments || []).length + ')'} styles={styles}>
                  {(detail.payments || []).length === 0 ? <Text style={styles.kv}>No payments.</Text> :
                    (detail.payments || []).map((x: any, i: number) => (
                      <View key={i} style={styles.subcard}>
                        <Text style={styles.subtitle}>N{Number(x.amount || 0).toLocaleString()} · {(x.plan||'').toUpperCase()}</Text>
                        <Text style={styles.submeta}>+{x.scans_added} scans · ref {String(x.reference||'').slice(0,20)}</Text>
                        <Text style={styles.submeta}>{fmt(x.paid_at)}</Text>
                      </View>
                    ))
                  }
                </Section>
              ) : null}

              {tab === 'activity' && detail ? (
                <>
                  <Section title={'CHAT SESSIONS (' + (detail.sessions || []).length + ')'} styles={styles}>
                    {(detail.sessions || []).length === 0 ? <Text style={styles.kv}>None.</Text> :
                      (detail.sessions || []).map((x: any, i: number) => (
                        <View key={i} style={styles.subcard}>
                          <Text style={styles.subtitle}>{x.session_id}</Text>
                          <Text style={styles.submeta}>{x.message_count} messages</Text>
                          <Text style={styles.submeta}>{fmt(x.updated_at)}</Text>
                        </View>
                      ))
                    }
                  </Section>
                  <Section title={'MEMORY (' + (detail.memory || []).length + ')'} styles={styles}>
                    {(detail.memory || []).length === 0 ? <Text style={styles.kv}>Nothing remembered.</Text> :
                      (detail.memory || []).map((x: any, i: number) => (
                        <View key={i} style={styles.subcard}>
                          <Text style={styles.subtitle}>{x.key}</Text>
                          <Text style={styles.submeta}>{x.value}</Text>
                          <Text style={styles.submeta}>{fmt(x.updated_at)}</Text>
                        </View>
                      ))
                    }
                  </Section>
                  <Section title={'LOGINS (' + (detail.logins || []).length + ')'} styles={styles}>
                    {(detail.logins || []).length === 0 ? <Text style={styles.kv}>No logins logged.</Text> :
                      (detail.logins || []).slice(0, 30).map((x: any, i: number) => (
                        <View key={i} style={styles.subcard}>
                          <Text style={styles.submeta}>{x.platform} · {x.device_model} · {x.ip || '—'}</Text>
                          <Text style={styles.submeta}>{fmt(x.logged_at)}</Text>
                        </View>
                      ))
                    }
                  </Section>
                </>
              ) : null}

              {tab === 'market' && detail ? (
                <>
                  <Section title={'LISTINGS (' + (detail.listings || []).length + ')'} styles={styles}>
                    {(detail.listings || []).length === 0 ? <Text style={styles.kv}>None.</Text> :
                      (detail.listings || []).map((x: any, i: number) => (
                        <View key={i} style={styles.subcard}>
                          <Text style={styles.subtitle}>{x.title}</Text>
                          <Text style={styles.submeta}>N{Number(x.price||0).toLocaleString()} · qty {x.quantity} {x.unit||''} · {x.location||''}</Text>
                          <Text style={styles.submeta}>{fmt(x.created_at)}</Text>
                        </View>
                      ))
                    }
                  </Section>
                  <Section title={'BUY ORDERS (' + (detail.buy_orders || []).length + ')'} styles={styles}>
                    {(detail.buy_orders || []).length === 0 ? <Text style={styles.kv}>None.</Text> :
                      (detail.buy_orders || []).map((x: any, i: number) => (
                        <View key={i} style={styles.subcard}>
                          <Text style={styles.subtitle}>{x.listing_title || x.order_ref}</Text>
                          <Text style={styles.submeta}>N{Number(x.total||0).toLocaleString()} · {(x.status||'').toUpperCase()}</Text>
                          <Text style={styles.submeta}>{fmt(x.created_at)}</Text>
                        </View>
                      ))
                    }
                  </Section>
                  <Section title={'SELL ORDERS (' + (detail.sell_orders || []).length + ')'} styles={styles}>
                    {(detail.sell_orders || []).length === 0 ? <Text style={styles.kv}>None.</Text> :
                      (detail.sell_orders || []).map((x: any, i: number) => (
                        <View key={i} style={styles.subcard}>
                          <Text style={styles.subtitle}>{x.listing_title || x.order_ref}</Text>
                          <Text style={styles.submeta}>N{Number(x.total||0).toLocaleString()} · {(x.status||'').toUpperCase()}</Text>
                          <Text style={styles.submeta}>{fmt(x.created_at)}</Text>
                        </View>
                      ))
                    }
                  </Section>
                </>
              ) : null}

              {tab === 'ops' && detail ? (
                <>
                  <Section title={'TICKETS (' + (detail.tickets || []).length + ')'} styles={styles}>
                    {(detail.tickets || []).length === 0 ? <Text style={styles.kv}>None.</Text> :
                      (detail.tickets || []).map((x: any, i: number) => (
                        <View key={i} style={styles.subcard}>
                          <Text style={styles.subtitle}>{x.subject}</Text>
                          <Text style={styles.submeta}>{(x.status||'').toUpperCase()}</Text>
                          <Text style={styles.submeta}>{fmt(x.created_at)}</Text>
                        </View>
                      ))
                    }
                  </Section>
                  <Section title={'WITHDRAWALS (' + (detail.withdrawals || []).length + ')'} styles={styles}>
                    {(detail.withdrawals || []).length === 0 ? <Text style={styles.kv}>None.</Text> :
                      (detail.withdrawals || []).map((x: any, i: number) => (
                        <View key={i} style={styles.subcard}>
                          <Text style={styles.subtitle}>N{Number(x.amount||0).toLocaleString()}</Text>
                          <Text style={styles.submeta}>{(x.status||'').toUpperCase()}</Text>
                          <Text style={styles.submeta}>Requested {fmt(x.requested_at)}</Text>
                          {x.settled_at ? <Text style={styles.submeta}>Settled {fmt(x.settled_at)}</Text> : null}
                        </View>
                      ))
                    }
                  </Section>
                  <Section title={'BADGES (' + (detail.badges || []).length + ')'} styles={styles}>
                    {(detail.badges || []).length === 0 ? <Text style={styles.kv}>None.</Text> :
                      (detail.badges || []).map((x: any, i: number) => (
                        <View key={i} style={styles.subcard}>
                          <Text style={styles.subtitle}>{(x.badge_tier || '').toUpperCase()}</Text>
                          <Text style={styles.submeta}>Since {fmt(x.subscribed_at)} · expires {fmt(x.expires_at)}</Text>
                        </View>
                      ))
                    }
                  </Section>
                </>
              ) : null}

              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Section({ title, styles, children }: any) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

function KV({ k, v, styles }: any) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvVal} numberOfLines={2}>{v || '—'}</Text>
    </View>
  );
}

function dotColor(kind: string, p: any) {
  const map: any = {
    signup: '#4fc3f7', login: '#8899a6', payment: '#ffb300',
    listing: '#b388ff', order_buy: '#00c853', order_sell: '#69f0ae',
    kyc: '#ff9800', chat: '#00ff88', badge: '#fdd835',
    ticket: '#ff3b5c', withdrawal: '#ef5350',
  };
  return map[kind] || p.neon;
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 12 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14, marginBottom: 12 },
  searchBtn: { paddingHorizontal: 18, borderRadius: 12, backgroundColor: p.neon, justifyContent: 'center', alignItems: 'center' },
  searchBtnText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,255,136,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 18, fontWeight: '900', color: p.neon },
  cardName: { fontSize: 14, fontWeight: '800', color: p.text },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: p.textDim },
  empty: { textAlign: 'center', color: p.textMuted, marginTop: 30, fontSize: 13 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginBottom: 8 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  kvKey: { fontSize: 11, color: p.textMuted, flex: 1 },
  kvVal: { fontSize: 12, color: p.text, flex: 1.6, textAlign: 'right' },
  kv: { fontSize: 12, color: p.textMuted },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  tlTitle: { fontSize: 13, fontWeight: '700', color: p.text },
  tlDetail: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  tlAt: { fontSize: 10, color: p.textDim, marginTop: 4 },
  subcard: { padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 6 },
  subtitle: { fontSize: 13, fontWeight: '800', color: p.text },
  submeta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '94%' },
  tabBar: { marginTop: 12, marginBottom: 8, maxHeight: 40 },
  tabBarInner: { gap: 6, paddingRight: 8 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  tabBtnOn: { backgroundColor: 'rgba(0,255,136,0.12)', borderColor: p.neon },
  tabText: { fontSize: 10, fontWeight: '700', color: p.textDim },
  tabTextOn: { color: p.neon },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
