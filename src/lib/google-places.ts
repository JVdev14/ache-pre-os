// Integração com Google Places API para busca precisa de estabelecimentos

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  type: string;
  rating?: number;
  totalRatings?: number;
  phoneNumber?: string;
  website?: string;
  openNow?: boolean;
  priceLevel?: number;
  photos?: string[];
  location: {
    lat: number;
    lng: number;
  };
}

/**
 * Busca estabelecimentos usando Google Places API
 */
export async function searchPlacesWithGoogle(
  coordinates: { lat: number; lng: number },
  type: string,
  radius: number = 5000
): Promise<PlaceResult[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ Google Maps API key não configurada. Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para usar busca precisa.');
    return [];
  }

  try {
    // Mapeia tipos do nosso sistema para tipos do Google Places
    const googleType = mapToGooglePlaceType(type);

    // Busca usando Places API Nearby Search
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates.lat},${coordinates.lng}&radius=${radius}&type=${googleType}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Erro na Google Places API:', data.status);
      return [];
    }

    if (!data.results || data.results.length === 0) {
      return [];
    }

    // Processa resultados
    const places: PlaceResult[] = data.results.map((place: any) => ({
      id: place.place_id,
      name: place.name,
      address: place.vicinity || place.formatted_address || '',
      type: mapGoogleTypeToOurType(place.types?.[0] || googleType),
      rating: place.rating,
      totalRatings: place.user_ratings_total,
      openNow: place.opening_hours?.open_now,
      priceLevel: place.price_level,
      photos: place.photos?.map((photo: any) => 
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${apiKey}`
      ) || [],
      location: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      },
    }));

    return places;
  } catch (error) {
    console.error('Erro ao buscar estabelecimentos no Google Places:', error);
    return [];
  }
}

/**
 * Busca detalhes completos de um estabelecimento
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours,price_level,photos,geometry,types&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      return null;
    }

    const place = data.result;

    return {
      id: placeId,
      name: place.name,
      address: place.formatted_address || '',
      type: mapGoogleTypeToOurType(place.types?.[0] || ''),
      rating: place.rating,
      totalRatings: place.user_ratings_total,
      phoneNumber: place.formatted_phone_number,
      website: place.website,
      openNow: place.opening_hours?.open_now,
      priceLevel: place.price_level,
      photos: place.photos?.map((photo: any) => 
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${apiKey}`
      ) || [],
      location: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      },
    };
  } catch (error) {
    console.error('Erro ao buscar detalhes do estabelecimento:', error);
    return null;
  }
}

/**
 * Mapeia nossos tipos para tipos do Google Places
 */
function mapToGooglePlaceType(ourType: string): string {
  const typeMap: Record<string, string> = {
    'Mercado': 'supermarket',
    'Farmácia': 'pharmacy',
    'Lanchonete': 'restaurant',
    'Cafeteria': 'cafe',
    'Padaria': 'bakery',
    'Restaurante': 'restaurant',
    'Loja': 'store',
    'all': 'establishment',
  };

  return typeMap[ourType] || 'establishment';
}

/**
 * Mapeia tipos do Google Places para nossos tipos
 */
function mapGoogleTypeToOurType(googleType: string): string {
  const typeMap: Record<string, string> = {
    'supermarket': 'Mercado',
    'grocery_or_supermarket': 'Mercado',
    'pharmacy': 'Farmácia',
    'drugstore': 'Farmácia',
    'restaurant': 'Restaurante',
    'cafe': 'Cafeteria',
    'bakery': 'Padaria',
    'food': 'Lanchonete',
    'meal_takeaway': 'Lanchonete',
    'store': 'Loja',
  };

  return typeMap[googleType] || 'Loja';
}

/**
 * Verifica se a API key está configurada
 */
export function isGoogleMapsConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}
