import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../api/supabase';

const TYPE_LABEL: Record<string, string> = {
  crops: 'Crop disease',
  pests: 'Pest identification',
  soil: 'Soil analysis',
  livestock: 'Livestock health',
  video: 'Video field scan',
};

function escapeHtml(s: string): string {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  } as any)[c]);
}

export interface FarmReport {
  user: { name: string; email: string; phone?: string; state?: string; };
  scans: any[];
  summary: {
    total_scans: number;
    unique_diseases: number;
    avg_confidence: number;
    treatments_applied: number;
    improved: number;
    worsened: number;
  };
}

export function buildReportHtml(report: FarmReport): string {
  const { user, scans, summary } = report;
  const now = new Date();

  const scanRows = scans.map((s) => {
    const date = s.created_at ? new Date(s.created_at).toLocaleDateString('en-NG') : '—';
    const outcome = s.outcome ? s.outcome.toUpperCase() : '—';
    const treatment = s.treatment_applied ? 'Yes' : '—';
    return `
      <tr>
        <td>${date}</td>
        <td>${escapeHtml(TYPE_LABEL[s.type] || s.type)}</td>
        <td>${escapeHtml(s.top_label || '—')}</td>
        <td>${Math.round(s.confidence || 0)}%</td>
        <td>${treatment}</td>
        <td>${outcome}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    margin: 0;
    padding: 32px;
    background: #fff;
  }
  .header {
    border-bottom: 3px solid #00c853;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .header h1 {
    font-size: 28px;
    margin: 0;
    color: #0d4a1f;
    letter-spacing: -0.5px;
  }
  .header p {
    margin: 4px 0 0;
    color: #666;
    font-size: 12px;
  }
  .badge {
    display: inline-block;
    background: #e8f5e9;
    color: #0d4a1f;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    margin-top: 8px;
  }
  .farm-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
    margin-bottom: 24px;
    font-size: 12px;
  }
  .farm-info .label { color: #888; }
  .farm-info .value { color: #111; font-weight: 600; }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  .kpi {
    background: #f5f5f5;
    border-radius: 10px;
    padding: 14px;
    text-align: center;
    border: 1px solid #e5e5e5;
  }
  .kpi .num {
    font-size: 22px;
    font-weight: 800;
    color: #00c853;
    letter-spacing: -0.5px;
  }
  .kpi .lbl {
    font-size: 9px;
    font-weight: 700;
    color: #888;
    letter-spacing: 1.5px;
    margin-top: 4px;
  }
  h2 {
    font-size: 14px;
    color: #0d4a1f;
    letter-spacing: 2px;
    margin: 24px 0 12px;
    text-transform: uppercase;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  th {
    text-align: left;
    background: #f0f0f0;
    padding: 8px;
    font-weight: 700;
    color: #333;
    border-bottom: 2px solid #ddd;
  }
  td {
    padding: 8px;
    border-bottom: 1px solid #eee;
    color: #444;
  }
  tr:nth-child(even) td { background: #fafafa; }
  .footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #eee;
    font-size: 10px;
    color: #999;
    text-align: center;
  }
  .footer strong { color: #0d4a1f; }
</style>
</head>
<body>

<div class="header">
  <h1>GAIA Farm Health Report</h1>
  <p>Generated ${now.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })} at ${now.toLocaleTimeString('en-NG')}</p>
  <span class="badge">AI-POWERED DIAGNOSTICS</span>
</div>

<div class="farm-info">
  <div>
    <div class="label">Farmer</div>
    <div class="value">${escapeHtml(user.name || '—')}</div>
  </div>
  <div>
    <div class="label">Email</div>
    <div class="value">${escapeHtml(user.email || '—')}</div>
  </div>
  <div>
    <div class="label">Phone</div>
    <div class="value">${escapeHtml(user.phone || '—')}</div>
  </div>
  <div>
    <div class="label">State</div>
    <div class="value">${escapeHtml(user.state || '—')}</div>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi">
    <div class="num">${summary.total_scans}</div>
    <div class="lbl">TOTAL SCANS</div>
  </div>
  <div class="kpi">
    <div class="num">${summary.unique_diseases}</div>
    <div class="lbl">UNIQUE ISSUES</div>
  </div>
  <div class="kpi">
    <div class="num">${summary.avg_confidence}%</div>
    <div class="lbl">AVG CONFIDENCE</div>
  </div>
  <div class="kpi">
    <div class="num">${summary.treatments_applied}</div>
    <div class="lbl">TREATMENTS</div>
  </div>
  <div class="kpi">
    <div class="num">${summary.improved}</div>
    <div class="lbl">IMPROVED</div>
  </div>
  <div class="kpi">
    <div class="num">${summary.worsened}</div>
    <div class="lbl">WORSENED</div>
  </div>
</div>

<h2>Scan History</h2>
${scans.length === 0 ? '<p style="color:#999;text-align:center;padding:20px;">No scans recorded yet.</p>' : `
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Type</th>
      <th>Diagnosis</th>
      <th>Confidence</th>
      <th>Treated</th>
      <th>Outcome</th>
    </tr>
  </thead>
  <tbody>
    ${scanRows}
  </tbody>
</table>
`}

<div class="footer">
  <strong>GAIA</strong> — Global Agricultural Intelligence Assistant<br>
  Powered by Darkmoor Ltd · darkmoorltd@gmail.com<br>
  This report is generated from AI diagnostic scans and may be used for loan, insurance, and cooperative applications.
</div>

</body>
</html>
  `;
}

export async function generateScanReport(
  filters?: { days?: number; type?: string },
): Promise<{ uri: string | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { uri: null, error: 'Not signed in' };

    // fetch profile
    const { data: prof } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, email, phone, state')
      .eq('user_id', user.id)
      .maybeSingle();

    // fetch scans
    let q = supabase
      .from('scan_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (filters?.days) {
      const since = new Date(Date.now() - filters.days * 86400000).toISOString();
      q = q.gte('created_at', since);
    }
    if (filters?.type && filters.type !== 'ALL') {
      q = q.eq('type', filters.type.toLowerCase());
    }

    const { data: scans, error: scanErr } = await q.limit(200);
    if (scanErr) return { uri: null, error: scanErr.message };

    const list = scans || [];

    // summary
    const diseases = new Set<string>();
    let confidenceSum = 0;
    let treatments = 0;
    let improved = 0;
    let worsened = 0;
    list.forEach((s) => {
      if (s.top_label) diseases.add(s.top_label);
      confidenceSum += Number(s.confidence || 0);
      if (s.treatment_applied) treatments++;
      if (s.outcome === 'improved' || s.outcome === 'resolved') improved++;
      if (s.outcome === 'worsened') worsened++;
    });

    const report: FarmReport = {
      user: {
        name: [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || user.email || 'Farmer',
        email: prof?.email || user.email || '',
        phone: prof?.phone || undefined,
        state: prof?.state || undefined,
      },
      scans: list,
      summary: {
        total_scans: list.length,
        unique_diseases: diseases.size,
        avg_confidence: list.length ? Math.round(confidenceSum / list.length) : 0,
        treatments_applied: treatments,
        improved,
        worsened,
      },
    };

    const html = buildReportHtml(report);
    const { uri } = await Print.printToFileAsync({ html });
    return { uri, error: null };
  } catch (e: any) {
    return { uri: null, error: e?.message || 'Report generation failed' };
  }
}

export async function shareScanReport(
  filters?: { days?: number; type?: string },
): Promise<{ ok: boolean; error?: string }> {
  const { uri, error } = await generateScanReport(filters);
  if (!uri) return { ok: false, error: error || 'No file' };
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, error: 'Sharing not available on this device' };
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share GAIA Farm Report',
      UTI: 'com.adobe.pdf',
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Share failed' };
  }
}
