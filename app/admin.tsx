import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

interface Item { label: string; route: string }
interface Section { title: string; icon: string; items: Item[]; color?: string }

const SECTIONS: Section[] = [
  {
    title: 'OVERVIEW',
    icon: 'OV',
    items: [
      { label: 'KPI Dashboard',       route: '/admin-dashboard' },
      { label: 'Analytics',           route: '/admin-analytics' },
    ],
  },
  {
    title: 'USERS',
    icon: 'US',
    items: [
      { label: 'Advanced Search',     route: '/admin-advanced-search' },
      { label: 'All Users',           route: '/admin-users' },
      { label: 'Verifications',       route: '/admin-verifications' },
      { label: 'Farmer Database',     route: '/admin-farmers' },
      { label: 'Scan History',        route: '/admin-scans' },
      { label: 'Login History',       route: '/admin-logins' },
    ],
  },
  {
    title: 'AGENTS',
    icon: 'AG',
    items: [
      { label: 'Manage Agents',       route: '/admin-agents' },
    ],
  },
  {
    title: 'FINANCE',
    icon: 'FN',
    items: [
      { label: 'Payments',            route: '/admin-payments' },
      { label: 'Wallets',             route: '/admin-wallets' },
      { label: 'Provision Wallets',   route: '/admin-provision-wallets' },
      { label: 'Loans',               route: '/admin-loans' },
      { label: 'Loan Management',     route: '/admin-loans-mobile' },
      { label: 'Withdrawals & Disputes', route: '/admin-ops' },
    ],
  },
  {
    title: 'MARKETPLACE',
    icon: 'MK',
    items: [
      { label: 'Marketplace Moderation', route: '/admin-marketplace' },
    ],
  },
  {
    title: 'CONTENT',
    icon: 'CT',
    items: [
      { label: 'Support Tickets',     route: '/admin-support' },
      { label: 'Broadcast Notifications', route: '/admin-broadcast' },
      { label: 'GAIA University',     route: '/admin-courses' },
      { label: 'Live Class Cohorts',  route: '/admin-cohorts' },
    ],
  },
  {
    title: 'SYSTEM',
    icon: 'SY',
    items: [
      { label: 'Remote Config',       route: '/admin-config' },
      { label: 'Model Health',        route: '/admin-models' },
      { label: 'Audit Log',           route: '/admin-audit' },
      { label: 'Bulk Tools',          route: '/admin-tools' },
      { label: 'Export CSV',          route: '/admin-export' },
    ],
  },
];

const BOA_SECTIONS: Section[] = [
  {
    title: 'BANK OF AGRICULTURE',
    icon: 'BA',
    color: '#00ff88',
    items: [
      { label: 'BOA Portfolio',       route: '/boa-dashboard' },
      { label: 'Risk Radar',          route: '/boa-risk' },
      { label: 'Borrowers',           route: '/boa-borrowers' },
      { label: 'Collections Forecast', route: '/boa-forecast' },
      { label: 'Portfolio Map',       route: '/boa-map' },
      { label: 'Risk-Based Pricing',  route: '/boa-pricing' },
      { label: 'Restructure Queue',   route: '/boa-restructure' },
      { label: 'Fraud Rings',         route: '/boa-fraud' },
      { label: 'Food Security',       route: '/boa-food-security' },
      { label: 'Peer Benchmark',      route: '/boa-benchmark' },
      { label: 'CSV Import',          route: '/boa-csv-import' },
      { label: 'Board Pack',          route: '/boa-board-pack' },
      { label: 'Cooperatives',        route: '/boa-coops' },
      { label: 'Warehouse Receipts',  route: '/boa-receipts' },
      { label: 'Field Officers',      route: '/boa-field-officers' },
    ],
  },
];

const MINISTRY_SECTIONS: Section[] = [
  {
    title: 'MINISTRY OF AGRICULTURE',
    icon: 'MA',
    color: '#ffb300',
    items: [
      { label: 'National Dashboard',  route: '/ministry-dashboard' },
      { label: 'Disease Surveillance', route: '/ministry-disease-map' },
      { label: 'Harvest Forecast',    route: '/ministry-harvest-forecast' },
      { label: 'Program Delivery',    route: '/ministry-program-delivery' },
      { label: 'Farmer Registry',     route: '/ministry-farmer-registry' },
      { label: 'Yield Gap Analysis',  route: '/ministry-yield-gap' },
      { label: 'Food Security Index', route: '/ministry-food-security' },
      { label: 'Policy Simulator',    route: '/ministry-policy-simulator' },
      { label: 'Cooperative Network', route: '/ministry-cooperatives' },
      { label: 'Price Monitor',       route: '/ministry-price-monitor' },
      { label: 'Extension Impact',    route: '/ministry-extension' },
      { label: 'Executive Briefing',  route: '/ministry-briefing' },
      { label: 'Savings Oversight',   route: '/ministry-rosca' },
    ],
  },
];

const OTHER_SECTIONS: Section[] = [
  {
    title: 'GAIA MEET',
    icon: 'GM',
    color: '#69f0ae',
    items: [
      { label: 'Consultations',       route: '/meet' },
    ],
  },
];

export default function Admin() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const auth: any = useAuth();
  const user = auth.user;

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  if (!isAdmin) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedText}>Access denied</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const renderSection = (section: Section, si: number) => (
    <View key={si} style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, section.color ? { backgroundColor: section.color + '22', borderColor: section.color } : null]}>
          <Text style={[styles.sectionIcon, section.color ? { color: section.color } : null]}>{section.icon}</Text>
        </View>
        <Text style={[styles.sectionTitle, section.color ? { color: section.color } : null]}>{section.title}</Text>
      </View>
      <View style={styles.sectionItems}>
        {section.items.map((item, ii) => (
          <Pressable
            key={ii}
            onPress={() => router.push(item.route as any)}
            style={({ pressed }) => [
              styles.item,
              ii === section.items.length - 1 && styles.itemLast,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Text style={styles.itemChevron}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.role}>ADMIN</Text>
        <Pressable
          onPress={() => {
            if (typeof router.canGoBack === 'function' && router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile' as any);
            }
          }}
          style={styles.backLink}
          hitSlop={10}
        >
          <Text style={styles.backLinkText}>{'<'} BACK</Text>
        </Pressable>
        <Text style={styles.title}>Control Panel</Text>
        <Text style={styles.email}>{user?.email}</Text>

        {SECTIONS.map(renderSection)}
        {BOA_SECTIONS.map(renderSection)}
        {MINISTRY_SECTIONS.map(renderSection)}
        {OTHER_SECTIONS.map(renderSection)}

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
  backLink: { paddingVertical: 8, paddingHorizontal: 4, alignSelf: 'flex-start', marginBottom: 8 },
  backLinkText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: p.neon },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionIconWrap: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionIcon: { fontSize: 9, fontWeight: '900', color: p.neon, letterSpacing: 0.5 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted },

  sectionItems: {
    borderRadius: radius.lg,
    backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  },
  itemLast: { borderBottomWidth: 0 },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: p.text },
  itemChevron: { fontSize: 20, color: p.textDim },

  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 24, fontWeight: '900', color: p.danger, marginBottom: 20 },
  backBtn: { padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: p.borderHi },
  backBtnText: { fontWeight: '800', color: p.neon },
});
