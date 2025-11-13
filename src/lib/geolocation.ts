// Serviço de Geolocalização e APIs de Localização

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface AddressInfo {
  cep?: string;
  city: string;
  state: string;
  street?: string;
  neighborhood?: string;
  coordinates: Coordinates;
}

/**
 * Busca informações de endereço pelo CEP usando ViaCEP
 */
export async function getAddressFromCEP(cep: string): Promise<AddressInfo | null> {
  try {
    const cleanCEP = cep.replace(/\D/g, '');
    
    if (cleanCEP.length !== 8) {
      throw new Error('CEP inválido');
    }

    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    
    if (!response.ok) {
      throw new Error('Erro ao buscar CEP');
    }

    const data = await response.json();

    if (data.erro) {
      throw new Error('CEP não encontrado');
    }

    // Busca coordenadas usando Nominatim (OpenStreetMap)
    const coordinates = await getCoordinatesFromAddress(
      `${data.logradouro}, ${data.localidade}, ${data.uf}, Brasil`
    );

    return {
      cep: data.cep,
      city: data.localidade,
      state: data.uf,
      street: data.logradouro,
      neighborhood: data.bairro,
      coordinates: coordinates || { lat: -23.5505, lng: -46.6333 }, // Fallback: São Paulo
    };
  } catch (error) {
    console.error('Erro ao buscar CEP:', error);
    return null;
  }
}

/**
 * Busca coordenadas de um endereço usando Nominatim (OpenStreetMap)
 */
export async function getCoordinatesFromAddress(address: string): Promise<Coordinates | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'PrecoFacil-App',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Erro ao buscar coordenadas');
    }

    const data = await response.json();

    if (data.length === 0) {
      return null;
    }

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch (error) {
    console.error('Erro ao buscar coordenadas:', error);
    return null;
  }
}

/**
 * Busca coordenadas de uma cidade
 */
export async function getCoordinatesFromCity(city: string, state?: string): Promise<Coordinates | null> {
  const searchQuery = state ? `${city}, ${state}, Brasil` : `${city}, Brasil`;
  return getCoordinatesFromAddress(searchQuery);
}

/**
 * Verifica se o navegador suporta geolocalização e se há permissão
 */
async function checkGeolocationPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  // Verifica se navegador suporta geolocalização
  if (!navigator.geolocation) {
    return 'unsupported';
  }

  // Verifica se Permissions API está disponível
  if (!navigator.permissions) {
    return 'prompt'; // Assume que precisa pedir permissão
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch (error) {
    console.warn('Erro ao verificar permissão:', error);
    return 'prompt';
  }
}

/**
 * Obtém localização atual do usuário usando Geolocation API do navegador
 * VERSÃO CORRIGIDA com melhor tratamento de erros e permissões
 */
export async function getCurrentLocation(): Promise<Coordinates | null> {
  // Verifica permissão primeiro
  const permission = await checkGeolocationPermission();
  
  if (permission === 'unsupported') {
    console.error('Geolocalização não suportada pelo navegador');
    throw new Error('Seu navegador não suporta geolocalização. Tente usar um navegador mais recente.');
  }

  if (permission === 'denied') {
    console.error('Permissão de localização negada');
    throw new Error('Você negou o acesso à localização. Para usar esta função, vá em Configurações do navegador > Privacidade e Segurança > Permissões do site > Localização e permita o acesso para este site.');
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Tempo esgotado ao buscar sua localização. Verifique se o GPS está ativado e tente novamente.'));
    }, 20000); // 20 segundos - tempo mais generoso

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        clearTimeout(timeoutId);
        
        // Tratamento específico de erros com mensagens claras
        let errorMessage = 'Erro ao obter localização';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Você negou o acesso à localização. Clique no ícone de cadeado ao lado da URL e permita o acesso à localização.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Localização indisponível no momento. Verifique se o GPS está ativado e se você está em um local com boa conexão.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Tempo esgotado ao buscar localização. Verifique sua conexão e tente novamente.';
            break;
          default:
            errorMessage = 'Erro desconhecido ao obter localização. Tente novamente.';
        }
        
        console.error('Erro de geolocalização:', errorMessage, error);
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true, // Usa GPS para maior precisão
        timeout: 15000, // 15 segundos para obter posição
        maximumAge: 30000, // Aceita cache de até 30 segundos
      }
    );
  });
}

/**
 * Calcula distância entre duas coordenadas (em km) usando fórmula de Haversine
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Arredonda para 1 casa decimal
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
