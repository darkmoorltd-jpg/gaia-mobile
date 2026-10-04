import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function Admin() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return (
      <View style={styles.container}>
        <View style={styles.blocked}>
          <Text style={styles.blockedText}>Access denied</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>GO BACK</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const SECTIONS = [
    { title: 'Users', items: [
      { label: 'All Users', route: '/admin-users' },
      { label: 'Verifications', route: '/admin-verifications' },
      { label: 'Farmer Database', route: '/admin-farmers' },
    ]},
    { title: 'Finance', items: [
      { label: 'Payments', route: '/admin-payments' },
      { label: 'Wallets', route: '/admin-wallets' },
      { label: 'Loans', route: '/admin-loans' },
    ]},
    { title: 'Content', items: [
      { label: 'Marketplace', route: '/admin-marketplace' },
      { label: 'Support Tickets', route: '/admin-support' },
    ]},
    { title: 'System', items: [
      { label: 'Analytics', route: '/admin-analytics' },
      { label: 'Model Health', route: '/admin-models' },
    ]},
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.role}>ADMIN</Text>
        <Text style={styles.title}>Control Panel</Text>
        <Text style={styles.email}>{user.email}</Text>

        {SECTIONS.map((section, si) => (
          <View key={si}>
            <Text style={styles.sectionLabel}>{section.title.toUpperCase()}</Text>
            {section.items.map((item, ii) => (
              <Pressable key={ii} onPress={() => router.push(item.route as any)} style={styles.item}>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemChevron}>›</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <View style={{ height: 100 }} />
      
        <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.8, color: '#00ff88', marginTop: 20, marginBottom: 8, paddingHorizontal: 20 }}>
          BANK OF AGRICULTURE
        </Text>
        <Pressable onPress={() => router.push('/boa-dashboard' as any)} style={{ padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.06)' }}>
          <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#00ff88' }}>BOA PORTFOLIO</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/boa-risk' as any)} style={{ padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#ff3b5c', backgroundColor: 'rgba(255,59,92,0.06)' }}>
          <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#ff3b5c' }}>RISK RADAR</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/boa-borrowers' as any)} style={{ padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#ffb300', backgroundColor: 'rgba(255,179,0,0.06)' }}>
          <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#ffb300' }}>BORROWERS</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/boa-forecast' as any)} style={{ padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#4fc3f7', backgroundColor: 'rgba(79,195,247,0.06)' }}>
          <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#4fc3f7' }}>COLLECTIONS FORECAST</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/boa-map' as any)} style={{ padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#b388ff', backgroundColor: 'rgba(179,136,255,0.06)' }}>
          <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#b388ff' }}>PORTFOLIO MAP</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/boa-pricing' as any)} style={{ padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#00c853', backgroundColor: 'rgba(0,200,83,0.06)' }}>
          <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#00c853' }}>RISK-BASED PRICING</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/boa-restructure' as any)} style={{ padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#ff6b35', backgroundColor: 'rgba(255,107,53,0.06)' }}>
          <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#ff6b35' }}>RESTRUCTURE QUEUE</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/boa-fraud' as any)} style={{ padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#ff3b5c', backgroundColor: 'rgba(255,59,92,0.06)' }}>
          <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#ff3b5c' }}>FRAUD RINGS</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/boa-food-security' as any)} style={{ padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#69f0ae', backgroundColor: 'rgba(105,240,174,0.06)' }}>
          <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#69f0ae' }}>FOOD SECURITY</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/boa-benchmark' as any)} style={{ padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#fdd835', backgroundColor: 'rgba(253,216,53,0.06)' }}>
          <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#fdd835' }}>PEER BENCHMARK</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/boa-csv-import' as any)} style={{ padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#26c6da', backgroundColor: 'rgba(38,198,218,0.06)' }}>
          <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#26c6da' }}>CSV LOAN IMPORT</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/boa-board-pack' as any)} style={{ padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#ab47bc', backgroundColor: 'rgba(171,71,188,0.06)' }}>
          <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#ab47bc' }}>BOARD PACK</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  role: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.danger },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -1, color: p.text, marginTop: 4 },
  email: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  itemLabel: { fontSize: 15, fontWeight: '600', color: p.text },
  itemChevron: { fontSize: 22, color: p.textDim },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 24, fontWeight: '900', color: p.danger, marginBottom: 20 },
  backBtn: { padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: p.borderHi },
  backBtnText: { fontWeight: '800', color: p.neon },
});
