import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/store/auth';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function Profile() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user, scansRemaining, plan, signOut } = useAuth();
  const styles = createStyles(palette);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const ITEMS = [
    { label: 'Scan History', route: '/history' },
    { label: 'Payment History', route: '/payment-history' },
    { label: 'Wallet', route: '/wallet' },
    { label: 'Badges', route: '/badges' },
    { label: 'Verification', route: '/verification' },
    { label: 'Marketplace', route: '/marketplace' },
    { label: 'My Store (Seller)', route: '/marketplace-store' },
    { label: 'My Orders', route: '/marketplace-orders' },
    { label: 'Early Warning', route: '/early-warning' },
    { label: 'University', route: '/university' },
    { label: 'Farming Calendar', route: '/calendar' },
    { label: 'Help and Support', route: '/help' },
    { label: 'Settings', route: '/settings' },
  ];

  const firstName = user?.email?.split('@')[0] || 'Farmer';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{firstName}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{scansRemaining}</Text>
            <Text style={styles.statLbl}>SCANS</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{plan[0].toUpperCase()}</Text>
            <Text style={styles.statLbl}>PLAN</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        {ITEMS.map((item, i) => (
          <Pressable key={i} onPress={() => router.push(item.route as any)} style={styles.item}>
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Text style={styles.itemChevron}>›</Text>
          </Pressable>
        ))}

        {isAdmin ? (
          <Pressable onPress={() => router.push('/admin' as any)} style={styles.adminItem}>
            <Text style={styles.adminLabel}>ADMIN CONSOLE</Text>
            <Text style={styles.adminChevron}>›</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => signOut()} style={styles.logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: p.neonSoft, borderWidth: 2, borderColor: p.borderHi, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 40, fontWeight: '900', color: p.neon },
  name: { fontSize: 24, fontWeight: '900', color: p.text, marginTop: 12, textTransform: 'capitalize', letterSpacing: -0.5 },
  email: { fontSize: 14, color: p.textMuted, marginTop: 4 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  stat: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '900', color: p.neon },
  statLbl: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2, color: p.textMuted, marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.5, color: p.textMuted, marginBottom: 8 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  itemLabel: { fontSize: 15, fontWeight: '600', color: p.text },
  itemChevron: { fontSize: 22, color: p.textDim },
  adminItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,60,90,0.08)', marginTop: 8, borderWidth: 1.5, borderColor: p.danger },
  adminLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: p.danger },
  adminChevron: { fontSize: 22, color: p.danger },
  logout: { marginTop: 24, padding: 18, borderRadius: 14, borderWidth: 1.5, borderColor: p.danger, alignItems: 'center' },
  logoutText: { fontSize: 15, fontWeight: '800', color: p.danger },
});
