import { supabase } from '../api/supabase';

export interface Listing {
  id: number;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  quantity: number;
  location: string;
  images: string[];
  delivery_method: string;
  delivery_fee: number;
  rating: number;
  reviews_count: number;
  views: number;
  sold: boolean;
  featured_until?: string;
  created_at: string;
}

export const CATEGORIES = [
  'All', 'Maize', 'Rice', 'Cassava', 'Tomato', 'Pepper', 'Cabbage',
  'Beans', 'Yam', 'Potato', 'Groundnut', 'Soybean', 'Other',
];

export const UNITS = [
  'per kg', 'per ton', 'per bag', 'per basket', 'per crate',
  'per piece', 'per 100kg',
];

export async function isVerifiedSeller(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('farmer_verifications')
      .select('status')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .maybeSingle();
    return !!data;
  } catch { return false; }
}

export async function fetchListings(category?: string): Promise<Listing[]> {
  try {
    let q = supabase
      .from('marketplace_listings')
      .select('*')
      .eq('sold', false)
      .order('created_at', { ascending: false })
      .limit(200);
    if (category && category !== 'All') q = q.eq('category', category);
    const { data } = await q;
    return (data || []) as Listing[];
  } catch { return []; }
}

export async function fetchListingById(id: number | string): Promise<Listing | null> {
  try {
    const { data } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return (data as Listing) || null;
  } catch { return null; }
}

export async function uploadListingImage(userId: string, uri: string): Promise<string | null> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    const buf = await new Response(blob).arrayBuffer();
    const rand = Math.random().toString(36).slice(2, 8);
    const path = userId + '/' + Date.now() + '_' + rand + '.jpg';
    const { error } = await supabase.storage
      .from('listing-images')
      .upload(path, buf, { contentType: 'image/jpeg' });
    if (error) return null;
    const { data } = supabase.storage.from('listing-images').getPublicUrl(path);
    return data.publicUrl;
  } catch { return null; }
}

export async function createListing(
  userId: string,
  listing: Partial<Listing>,
): Promise<{ id: number | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .insert({
        seller_id: userId,
        title: listing.title,
        description: listing.description || '',
        category: listing.category,
        price: listing.price,
        unit: listing.unit,
        quantity: listing.quantity,
        location: listing.location || '',
        images: listing.images || [],
        delivery_method: listing.delivery_method || 'both',
        delivery_fee: listing.delivery_fee || 0,
      })
      .select()
      .single();
    return { id: data ? data.id : null, error: error ? error.message : null };
  } catch (e: any) {
    return { id: null, error: e.message || 'Insert failed' };
  }
}

export async function deleteListing(id: number) {
  await supabase.from('marketplace_listings').delete().eq('id', id);
}

export async function fetchSellerListings(sellerId: string): Promise<Listing[]> {
  try {
    const { data } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });
    return (data || []) as Listing[];
  } catch { return []; }
}

export async function addToCart(buyerId: string, listingId: number, quantity: number = 1) {
  try {
    const { data: existing } = await supabase
      .from('marketplace_carts')
      .select('*')
      .eq('buyer_id', buyerId)
      .eq('listing_id', listingId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from('marketplace_carts')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('marketplace_carts')
        .insert({ buyer_id: buyerId, listing_id: listingId, quantity });
    }
  } catch {}
}

export async function fetchCart(buyerId: string): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('marketplace_carts')
      .select('*')
      .eq('buyer_id', buyerId);
    if (!data || data.length === 0) return [];
    const ids = data.map((c: any) => c.listing_id);
    const { data: listings } = await supabase
      .from('marketplace_listings')
      .select('*')
      .in('id', ids);
    const map: any = {};
    (listings || []).forEach((l: any) => { map[l.id] = l; });
    return data.map((c: any) => ({ ...c, listing: map[c.listing_id] || null }));
  } catch { return []; }
}

export async function updateCartQty(cartId: number, quantity: number) {
  try {
    if (quantity <= 0) {
      await supabase.from('marketplace_carts').delete().eq('id', cartId);
    } else {
      await supabase.from('marketplace_carts').update({ quantity }).eq('id', cartId);
    }
  } catch {}
}

export async function clearCart(buyerId: string) {
  try {
    await supabase.from('marketplace_carts').delete().eq('buyer_id', buyerId);
  } catch {}
}

export function makeOrderRef(): string {
  const d = new Date();
  const ymd =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return 'GAIA-' + ymd + '-' + rand;
}

export async function createOrder(payload: any) {
  try {
    const { data, error } = await supabase
      .from('marketplace_orders')
      .insert(payload)
      .select()
      .single();
    return { data, error: error ? error.message : null };
  } catch (e: any) {
    return { data: null, error: e.message };
  }
}

export async function fetchBuyerOrders(buyerId: string) {
  try {
    const { data } = await supabase
      .from('marketplace_orders')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false })
      .limit(100);
    return data || [];
  } catch { return []; }
}

export async function fetchSellerOrders(sellerId: string) {
  try {
    const { data } = await supabase
      .from('marketplace_orders')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(100);
    return data || [];
  } catch { return []; }
}

export async function updateOrderStatus(orderId: number, status: string) {
  try {
    const update: any = { status };
    if (status === 'shipped') update.shipped_at = new Date().toISOString();
    if (status === 'delivered') update.delivered_at = new Date().toISOString();
    if (status === 'confirmed') update.confirmed_at = new Date().toISOString();
    await supabase.from('marketplace_orders').update(update).eq('id', orderId);
  } catch {}
}

export async function getSellerProfile(sellerId: string) {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', sellerId)
      .maybeSingle();
    return data || {};
  } catch { return {}; }
}

export function naira(n: number) {
  try {
    return 'N' + Number(n || 0).toLocaleString('en-NG');
  } catch { return 'N0'; }
}

export function statusColor(status: string, palette: any) {
  switch (status) {
    case 'pending': return palette.warning;
    case 'paid': return palette.neon;
    case 'shipped': return '#66d9ff';
    case 'delivered': return palette.neon;
    case 'confirmed': return palette.neon;
    case 'disputed': return palette.danger;
    default: return palette.textMuted;
  }
}
