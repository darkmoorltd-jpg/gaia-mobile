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
