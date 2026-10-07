import { supabase } from '../api/supabase';

export interface Group {
  id: string;
  name: string;
  contribution_amount: number;
  frequency: string;
  cycle_members: number;
  currency: string;
  owner_id: string;
  invite_code: string;
  status: string;
  variant: string;
  state: string | null;
  lga: string | null;
  description: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  members: number;
  balance: number;
  escrow: number;
  is_member: boolean;
}

export interface GroupMember {
  user_id: string;
  position: number;
  has_collected: boolean;
  collected_at: string | null;
  total_paid: number;
  penalty_accrued: number;
  status: string;
  due_date: string | null;
  joined_at: string;
  email: string | null;
  name: string | null;
}

export interface Contribution {
  id: number;
  user_id: string;
  amount: number;
  round: number;
  paid_at: string;
  due_date: string | null;
  paid_late: boolean;
  penalty: number;
  approved: boolean;
  email: string | null;
}

export interface GroupEvent {
  id: number;
  actor_id: string | null;
  kind: string;
  details: any;
  created_at: string;
}

export interface GroupDetail {
  group: Group;
  wallet: { group_id: string; balance: number; escrow: number } | null;
  members: GroupMember[];
  contributions: Contribution[];
  events: GroupEvent[];
}

function unwrap<T>(r: { data: T | null; error: any }): T {
  if (r.error) throw new Error(r.error.message || 'Request failed');
  return r.data as T;
}

export async function isVerified(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return false;
  const r = await supabase.rpc('user_is_verified', { p_user_id: uid });
  if (r.error) return false;
  return r.data === true;
}

export async function listMyGroups(): Promise<Group[]> {
  return unwrap(await supabase.rpc('rosca_list_my_groups'));
}

export async function getGroupDetail(groupId: string): Promise<GroupDetail> {
  return unwrap(await supabase.rpc('rosca_group_detail', { p_group_id: groupId }));
}

export async function createGroup(input: {
  name: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  cycle_members: number;
  variant?: string;
  state?: string;
  lga?: string;
  description?: string;
}): Promise<{ id: string; invite_code: string }> {
  return unwrap(await supabase.rpc('rosca_create_group', {
    p_name: input.name,
    p_amount: input.amount,
    p_frequency: input.frequency,
    p_cycle_members: input.cycle_members,
    p_variant: input.variant || 'esusu',
    p_state: input.state || null,
    p_lga: input.lga || null,
    p_description: input.description || null,
  }));
}

export async function joinGroup(inviteCode: string): Promise<{ group_id: string; position: number }> {
  return unwrap(await supabase.rpc('rosca_join_group', { p_invite_code: inviteCode }));
}

export async function startCycle(groupId: string): Promise<{ started: boolean; first_due: string }> {
  return unwrap(await supabase.rpc('rosca_start_cycle', { p_group_id: groupId }));
}

export async function contribute(groupId: string, pin: string): Promise<{
  contribution_id: number;
  amount: number;
  penalty: number;
  balance: number;
  escrow: number;
  round: number;
}> {
  return unwrap(await supabase.rpc('rosca_contribute', { p_group_id: groupId, p_pin: pin }));
}

export async function approveContribution(contributionId: number): Promise<void> {
  const r = await supabase.rpc('rosca_approve', { p_contribution_id: contributionId });
  if (r.error) throw new Error(r.error.message || 'Approve failed');
}

export async function triggerPayout(groupId: string): Promise<{ recipient: string; amount: number }> {
  return unwrap(await supabase.rpc('rosca_payout', { p_group_id: groupId }));
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  const r = await supabase.rpc('rosca_remove_member', {
    p_group_id: groupId, p_user_id: userId,
  });
  if (r.error) throw new Error(r.error.message || 'Remove failed');
}

export async function leaveGroup(groupId: string): Promise<{ refund: number }> {
  return unwrap(await supabase.rpc('rosca_leave', { p_group_id: groupId }));
}

export function fmtN(n: any, dp: number = 0): string {
  return 'N' + Number(n || 0).toLocaleString('en-NG', {
    minimumFractionDigits: dp, maximumFractionDigits: dp,
  });
}

export function fmtDate(s?: string | null): string {
  if (!s) return '-';
  try { return new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '-'; }
}

export function fmtDateTime(s?: string | null): string {
  if (!s) return '-';
  try { return new Date(s).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '-'; }
}

export const FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
export const VARIANTS = [
  { key: 'esusu', label: 'Esusu (Weekly)' },
  { key: 'ajo', label: 'Ajo (Daily)' },
  { key: 'adashe', label: 'Adashe (Monthly)' },
  { key: 'cooperative', label: 'Cooperative' },
];

export interface TrustScore {
  score: number;
  band: 'excellent' | 'good' | 'fair' | 'poor';
  completed_rounds: number;
  total_contributions: number;
  on_time_rate_pct: number;
  days_active: number;
}

export async function getTrustScore(groupId: string): Promise<TrustScore> {
  return unwrap(await supabase.rpc('rosca_trust_score', { p_group_id: groupId }));
}

export async function sendReminders(groupId: string): Promise<number> {
  const r = await supabase.rpc('rosca_send_reminders', { p_group_id: groupId });
  if (r.error) throw new Error(r.error.message || 'Reminders failed');
  return Number(r.data || 0);
}

export async function downloadGroupStatementPDF(groupId: string): Promise<string | null> {
  const s = await supabase.auth.getSession();
  const token = s.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const FS = await import('expo-file-system/legacy');
  const path = FS.cacheDirectory + 'gaia-rosca-' + groupId.slice(0, 8) + '-' + Date.now() + '.pdf';
  const r = await FS.downloadAsync(
    'https://gaia-api-xuly.onrender.com/rosca/' + groupId + '/statement/pdf',
    path,
    { headers: { Authorization: 'Bearer ' + token } },
  );
  if (r.status !== 200) throw new Error('Download failed: ' + r.status);
  return r.uri;
}

export async function shareGroupStatement(groupId: string): Promise<void> {
  const uri = await downloadGroupStatementPDF(groupId);
  if (!uri) throw new Error('Download failed');
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing unavailable');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'GAIA ROSCA Statement',
    UTI: 'com.adobe.pdf',
  });
}

export function trustColor(band: string): string {
  if (band === 'excellent') return '#00ff88';
  if (band === 'good') return '#4fc3f7';
  if (band === 'fair') return '#ffb300';
  return '#ff3b5c';
}
