import { supabase } from '../api/supabase';

export interface DispatchOffer {
  id: string;
  trip_id: string;
  offered_fee_naira: number;
  distance_km: number;
  expires_at: string;
  trip_code: string;
  origin_location: string | null;
  destination_location: string | null;
}

export async function getMyOffers(): Promise<DispatchOffer[]> {
  const { data, error } = await supabase.rpc('driver_my_offers');
  if (error || !Array.isArray(data)) return [];
  return data as DispatchOffer[];
}

export async function acceptOffer(offerId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('dispatch_accept', { p_offer_id: offerId });
  return !error && data === true;
}

export async function startTrip(tripId: string): Promise<boolean> {
  const { error } = await supabase.rpc('trip_start', { p_trip_id: tripId });
  return !error;
}

export async function logIncident(tripId: string, type: string, lat: number, lon: number, description: string, amount = 0): Promise<boolean> {
  const { error } = await supabase.rpc('trip_log_incident', {
    p_trip_id: tripId, p_type: type, p_lat: lat, p_lon: lon, p_description: description, p_amount: amount,
  });
  return !error;
}

export async function logFuel(tripId: string, liters: number, price: number, station: string, odometer: number, fromAdvance: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('trip_log_fuel', {
    p_trip_id: tripId, p_liters: liters, p_price: price,
    p_station: station, p_odometer: odometer, p_from_advance: fromAdvance,
  });
  return !error;
}

export async function completeTrip(tripId: string, finalWeight: number, loss = 0): Promise<boolean> {
  const { error } = await supabase.rpc('trip_complete', {
    p_trip_id: tripId, p_final_weight_kg: finalWeight, p_loss_kg: loss,
  });
  return !error;
}
