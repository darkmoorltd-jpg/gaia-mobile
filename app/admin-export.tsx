import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function AdminExportScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [busy, setBusy] = useState(false);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_export_farmers', { p_limit: 5000 });
      if (error) throw error;
      setFarmers(data || []);
      setLoaded(true);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  // ============================================================
  // EXPORT TO EXCEL (CSV)
  // ============================================================
  const exportToExcel = async () => {
    if (farmers.length === 0) return;
    setBusy(true);
    try {
      const headers = ['Farmer ID', 'Full Name', 'Phone', 'State', 'LGA', 'Crop', 'Farm Size (Acres)', 'BVN', 'NIN', 'KYC Status', 'Bank', 'Account No', 'Lat', 'Lon', 'Registered At'];
      
      const rows = farmers.map(f => [
        f.unique_farmer_id || '', f.full_name || '', f.phone || '', f.state || '', f.lga || '',
        f.primary_crop || '', f.farm_size_acres || 0, f.bvn || '', f.nin || '', f.kyc_status || '',
        f.bank_name || '', f.account_number || '', f.gps_lat || '', f.gps_lon || '', new Date(f.registered_at).toLocaleDateString()
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const fileUri = FileSystem.cacheDirectory + 'GAIA_Farmers_' + Date.now() + '.csv';
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Farmers to Excel' });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  // ============================================================
  // EXPORT TO PDF
  // ============================================================
  const exportToPDF = async () => {
    if (farmers.length === 0) return;
    setBusy(true);
    try {
      const rowsHtml = farmers.map((f, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${f.full_name || 'Unknown'}</td>
          <td>${f.phone || '-'}</td>
          <td>${f.state || '-'}</td>
          <td>${f.primary_crop || '-'}</td>
          <td>${f.farm_size_acres || 0}</td>
          <td>${f.kyc_status?.toUpperCase() || 'PENDING'}</td>
        </tr>
      `).join('');

      const html = `
        <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; }
            h1 { color: #1b5e20; text-align: center; }
            p { text-align: center; color: #666; margin-bottom: 30px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th { background-color: #e8f5e9; color: #1b5e20; padding: 10px; text-align: left; border-bottom: 2px solid #4caf50; }
            td { padding: 8px 10px; border-bottom: 1px solid #eee; }
            tr:nth-child(even) { background-color: #fafafa; }
            .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #888; }
          </style>
        </head>
        <body>
          <h1>GAIA National Farmer Registry Export</h1>
          <p>Generated on ${new Date().toLocaleString()} · Total Farmers: ${farmers.length}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Full Name</th>
                <th>Phone</th>
                <th>State</th>
                <th>Primary Crop</th>
                <th>Size (Ac)</th>
                <th>KYC Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="footer">Powered by Darkmoor Ltd · NDFR-Ready Data</div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Farmers to PDF' });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        
        <Text style={styles.title}>📊 Data Export</Text>
        <Text style={styles.subtitle}>Export NDFR-ready data for Ministry & BOA</Text>

        {!loaded && !busy ? (
          <Pressable onPress={loadData} style={styles.loadBtn}>
            <Text style={styles.loadBtnText}>Load Farmer Registry</Text>
          </Pressable>
        ) : null}

        {busy ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.neon} />
            <Text style={styles.busyText}>Processing...</Text>
          </View>
        ) : null}

        {loaded && !busy ? (
          <View style={styles.card}>
            <Text style={styles.count}>{farmers.length}</Text>
            <Text style={styles.countLabel}>Farmers Ready to Export</Text>

            <View style={styles.divider} />

            <Pressable onPress={exportToExcel} style={styles.exportBtn}>
              <Text style={styles.exportBtnText}>📥 Download Excel (CSV)</Text>
            </Pressable>

            <Pressable onPress={exportToPDF} style={[styles.exportBtn, { marginTop: 12, backgroundColor: '#ff3b5c' }]}>
              <Text style={styles.exportBtnText}>📄 Download PDF Report</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 24 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  busyText: { fontSize: 13, color: p.textMuted },
  loadBtn: { backgroundColor: p.neon, paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  loadBtnText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  card: { backgroundColor: p.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: p.border, alignItems: 'center', marginTop: 20 },
  count: { fontSize: 48, fontWeight: '900', color: p.neon, letterSpacing: -2 },
  countLabel: { fontSize: 13, color: p.textMuted, fontWeight: '600', marginTop: 4 },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 24 },
  exportBtn: { width: '100%', backgroundColor: p.neon, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  exportBtnText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
