import { useState } from 'react';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../src/theme';
import { walletMe, type WalletInfo } from '../src/utils/wallet';

export default function WalletReceive() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await walletMe();
    if (res) setWallet(res.wallet);
    setBusy(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const copyAcct = async () => {
    if (!wallet?.account_number) return;
    await Clipboard.setStringAsync(wallet.account_number);
    Alert.alert('Copied', wallet.account_number);
  };

  const share = async () => {
    if (!wallet?.account_number) return;
    const msg = 'Pay me on GAIA: ' + wallet.account_number + ' ' + (wallet.account_name || '') + ' ' + (wallet.bank_name || '');
    Share.share({ message: msg });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Receive Money</Text>
        <Text style={styles.sub}>Share your account details</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {wallet?.provisioned ? (
          <>
            <LinearGradient colors={['#00c853', '#009e52', '#003820']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
              <Text style={styles.cardKicker}>GAIA WALLET</Text>
              <Text style={styles.cardAcct}>{wallet.account_number}</Text>
              <Text style={styles.cardName}>{wallet.account_name}</Text>
              <Text style={styles.cardBank}>{wallet.bank_name}</Text>
            </LinearGradient>

            <Pressable onPress={copyAcct} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnTxt}>COPY ACCOUNT NUMBER</Text>
            </Pressable>
            <Pressable onPress={share} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnTxt}>SHARE WITH SOMEONE</Text>
            </Pressable>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>HOW IT WORKS</Text>
              <Text style={styles.infoText}>1. Share this account number with anyone</Text>
              <Text style={styles.infoText}>2. They transfer from any Nigerian bank</Text>
              <Text style={styles.infoText}>3. Money appears in your GAIA wallet in seconds</Text>
              <Text style={styles.infoText}>4. Send, withdraw, or spend - your choice</Text>
            </View>
          </>
        ) : (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingTitle}>Account not provisioned</Text>
            <Text style={styles.pendingText}>Verify your identity in Profile then Verification. Once approved, your GAIA account number is assigned automatically.</Text>
            <Pressable onPress={() => router.push('/verification' as any)} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnTxt}>GO TO VERIFICATION</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 24 },
  card: { padding: 30, borderRadius: 24, overflow: 'hidden' },
  cardKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: 'rgba(255,255,255,0.7)' },
  cardAcct: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: 3, marginTop: 10 },
  cardName: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginTop: 12, textTransform: 'uppercase' },
  cardBank: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  primaryBtn: { marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  primaryBtnTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
  secondaryBtn: { marginTop: 10, padding: 18, borderRadius: 14, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center' },
  secondaryBtnTxt: { fontSize: 13, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  infoBox: { marginTop: 24, padding: 18, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  infoTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginBottom: 10 },
  infoText: { fontSize: 12, color: p.text, marginBottom: 6, lineHeight: 18 },
  pendingBox: { padding: 24, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  pendingTitle: { fontSize: 18, fontWeight: '900', color: p.text, marginBottom: 8 },
  pendingText: { fontSize: 13, color: p.textMuted, lineHeight: 20, marginBottom: 12 },
});
