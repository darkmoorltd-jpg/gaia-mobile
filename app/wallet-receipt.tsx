import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Share } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme';
import { walletReceipt, fmtN, downloadReceiptPDF, downloadReceiptJPG, shareFile } from '../src/utils/wallet';

export default function WalletReceipt() {
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [sharing, setSharing] = useState<'pdf' | 'jpg' | null>(null);

  const load = useCallback(async () => {
    if (!ref) { setBusy(false); return; }
    setBusy(true);
    try {
      const r = await walletReceipt(String(ref));
      setData(r);
    } catch (e: any) {
      Alert.alert('Could not load receipt', e.message || 'Try again');
    } finally { setBusy(false); }
  }, [ref]);

  React.useEffect(() => { load(); }, [load]);

  const shareText = async () => {
    if (!data) return;
    const t = [
      'GAIA WALLET RECEIPT',
      'Receipt: ' + (data.receipt_number || ''),
      'Date: ' + new Date(data.created_at).toLocaleString(),
      'Amount: ' + fmtN(data.amount, 2),
      'Type: ' + data.type,
      'Status: ' + data.status,
      'Ref: ' + data.reference,
      'Account: ' + (data.account_number || ''),
    ].join('\n');
    Share.share({ message: t });
  };

  const sharePDF = async () => {
    if (!ref) return;
    setSharing('pdf');
    try {
      const uri = await downloadReceiptPDF(String(ref));
      if (!uri) throw new Error('Download failed');
      await shareFile(uri, 'application/pdf', 'GAIA Receipt');
    } catch (e: any) {
      Alert.alert('PDF failed', e?.message || 'Try again');
    } finally {
      setSharing(null);
    }
  };

  const shareJPG = async () => {
    if (!ref) return;
    setSharing('jpg');
    try {
      const uri = await downloadReceiptJPG(String(ref));
      if (!uri) throw new Error('Download failed');
      await shareFile(uri, 'image/jpeg', 'GAIA Receipt');
    } catch (e: any) {
      Alert.alert('JPG failed', e?.message || 'Try again');
    } finally {
      setSharing(null);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Receipt</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {data ? (
          <>
            <LinearGradient colors={['#0d1410', '#0a0e0c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.paper}>
              <Text style={styles.brand}>GAIA WALLET</Text>
              <Text style={styles.receiptNo}>{data.receipt_number || ''}</Text>

              <View style={styles.amountBox}>
                <Text style={styles.amountLbl}>{data.direction === 'in' ? 'CREDITED' : 'DEBITED'}</Text>
                <Text style={[styles.amountVal, { color: data.direction === 'in' ? '#00ff88' : '#fff' }]}>
                  {(data.direction === 'in' ? '+' : '-') + fmtN(data.amount, 2)}
                </Text>
              </View>

              <Line k='Date' v={new Date(data.created_at).toLocaleString()} styles={styles} />
              <Line k='Type' v={String(data.type).toUpperCase()} styles={styles} />
              <Line k='Status' v={String(data.status).toUpperCase()} styles={styles} />
              {data.counterparty_name ? <Line k='Counterparty' v={data.counterparty_name} styles={styles} /> : null}
              {data.counterparty_acct ? <Line k='Account' v={data.counterparty_acct} styles={styles} /> : null}
              <Line k='Reference' v={String(data.reference).slice(0, 32)} styles={styles} />
              <Line k='Your Account' v={data.account_number || '-'} styles={styles} />
              <Line k='Email' v={data.user_email || ''} styles={styles} />
              <Line k='Balance After' v={fmtN(data.current_balance, 2)} styles={styles} />

              <View style={styles.divider} />
              <Text style={styles.signOff}>Darkmoor Ltd | Powered by GAIA</Text>
            </LinearGradient>

            <Pressable onPress={shareJPG} disabled={sharing !== null} style={[styles.primaryBtn, sharing !== null && { opacity: 0.5 }]}>
              {sharing === 'jpg' ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.primaryBtnTxt}>SHARE AS IMAGE</Text>}
            </Pressable>
            <Pressable onPress={sharePDF} disabled={sharing !== null} style={[styles.secondaryBtn, sharing !== null && { opacity: 0.5 }]}>
              {sharing === 'pdf' ? <ActivityIndicator color={palette.neon} /> : <Text style={styles.secondaryBtnTxt}>SHARE AS PDF</Text>}
            </Pressable>
            <Pressable onPress={shareText} style={styles.tertiaryBtn}>
              <Text style={styles.tertiaryBtnTxt}>SHARE AS TEXT</Text>
            </Pressable>
          </>
        ) : null}

        {!busy && !data ? (
          <View style={styles.emptyBox}><Text style={styles.emptyTxt}>Receipt not found.</Text></View>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function Line({ k, v, styles }: any) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineK}>{k}</Text>
      <Text style={styles.lineV} numberOfLines={2}>{v}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginBottom: 20 },
  paper: { padding: 24, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)' },
  brand: { fontSize: 10, fontWeight: '900', letterSpacing: 3, color: '#00ff88', textAlign: 'center' },
  receiptNo: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 6, letterSpacing: 1 },
  amountBox: { padding: 20, borderRadius: 14, backgroundColor: 'rgba(0,255,136,0.06)', alignItems: 'center', marginTop: 20, marginBottom: 20 },
  amountLbl: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(255,255,255,0.6)' },
  amountVal: { fontSize: 36, fontWeight: '900', letterSpacing: -1.5, marginTop: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  lineK: { fontSize: 11, color: 'rgba(255,255,255,0.55)', flex: 1, marginRight: 12 },
  lineV: { fontSize: 12, fontWeight: '800', color: '#fff', flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: 'rgba(0,255,136,0.2)', marginVertical: 20 },
  signOff: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', letterSpacing: 1 },
  primaryBtn: { marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  primaryBtnTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
  secondaryBtn: { marginTop: 10, padding: 18, borderRadius: 14, borderWidth: 1.5, borderColor: p.neon, alignItems: 'center' },
  secondaryBtnTxt: { fontSize: 13, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  tertiaryBtn: { marginTop: 10, padding: 14, alignItems: 'center' },
  tertiaryBtnTxt: { fontSize: 12, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  emptyBox: { padding: 30, alignItems: 'center' },
  emptyTxt: { fontSize: 13, color: p.textMuted },
});
