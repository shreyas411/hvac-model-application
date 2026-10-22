// Address search through Google Places (New). Off unless VITE_GOOGLE_MAPS_API_KEY is set at build time.
// The key ships in the page, so restrict it in Google Cloud to this site's HTTP referrers and to the Places API only.
// What the user types is sent to Google while the search is on; nothing is sent when the key is unset.
const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const BASE = 'https://places.googleapis.com/v1';
const AUTOCOMPLETE = 'https://places.googleapis.com/$rpc/google.maps.places.v1.Places/AutocompletePlaces';

export const addressSearchEnabled = !!KEY;

export interface Suggestion { id: string; main: string; secondary: string }
export interface PickedAddress { line1: string; line2: string; city: string; postcode: string }
interface Component { longText?: string; shortText?: string; types?: string[] }

export function parseAddress(components: Component[]): PickedAddress {
  const get = (...types: string[]) => components.find((c) => types.some((t) => c.types?.includes(t)))?.longText ?? '';
  const street = [get('street_number'), get('route')].filter(Boolean).join(' ');
  // a flat or building name leads the line: "Flat 2, 10 Acacia Road" / "Rose Cottage, Mill Lane"
  const flat = get('subpremise');
  const building = get('street_number') ? '' : get('premise');
  const line1 = [flat, building, street].filter(Boolean).join(flat || building ? ', ' : ' ');
  return {
    line1,
    line2: '', // Google's sublocality is often a borough, not part of the postal address: leave line 2 to the user
    city: get('postal_town', 'locality', 'administrative_area_level_2'),
    postcode: get('postal_code'),
  };
}

const headers = (mask: string) => ({ 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY!, 'X-Goog-FieldMask': mask });

export async function suggest(input: string, session: string, signal: AbortSignal): Promise<Suggestion[]> {
  const res = await fetch(AUTOCOMPLETE, {
    method: 'POST', signal, headers: headers('suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat'),
    body: JSON.stringify({ input, sessionToken: session, includedRegionCodes: ['gb'], languageCode: 'en-GB' }),
  });
  if (!res.ok) throw new Error(`Places autocomplete ${res.status}`);
  const body = await res.json() as { suggestions?: { placePrediction?: { placeId: string; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }[] };
  return (body.suggestions ?? []).flatMap((s) => s.placePrediction ? [{
    id: s.placePrediction.placeId,
    main: s.placePrediction.structuredFormat?.mainText?.text ?? '',
    secondary: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
  }] : []);
}

export async function details(id: string, session: string): Promise<PickedAddress> {
  const res = await fetch(`${BASE}/places/${encodeURIComponent(id)}?sessionToken=${encodeURIComponent(session)}&languageCode=en-GB`, { headers: headers('addressComponents') });
  if (!res.ok) throw new Error(`Places details ${res.status}`);
  return parseAddress(((await res.json()) as { addressComponents?: Component[] }).addressComponents ?? []);
}
