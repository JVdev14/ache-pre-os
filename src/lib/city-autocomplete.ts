// Sistema de autocomplete de cidades usando API do IBGE

export interface CityOption {
  id: string;
  name: string;
  state: string;
  displayName: string;
}

// Interface para a resposta da API do IBGE
interface IBGECity {
  id: number;
  nome: string;
  microrregiao: {
    mesorregiao: {
      UF: {
        sigla: string;
      };
    };
  };
}

/**
 * Busca cidades brasileiras que correspondem ao termo de busca
 */
export async function searchCities(query: string): Promise<CityOption[]> {
  try {
    if (!query || query.length < 2) {
      return [];
    }

    // Busca cidades na API do IBGE
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome`
    );

    if (!response.ok) {
      throw new Error('Erro ao buscar cidades');
    }

    const data: IBGECity[] = await response.json();

    // Filtra cidades que correspondem ao termo de busca
    const normalizedQuery = normalizeString(query);
    
    const filteredCities = data
      .filter((city) => {
        const cityName = normalizeString(city.nome);
        return cityName.includes(normalizedQuery);
      })
      .slice(0, 10) // Limita a 10 resultados
      .map((city) => ({
        id: city.id.toString(),
        name: city.nome,
        state: city.microrregiao?.mesorregiao?.UF?.sigla || 'BR',
        displayName: `${city.nome} - ${city.microrregiao?.mesorregiao?.UF?.sigla || 'BR'}`,
      }));

    return filteredCities;
  } catch (error) {
    console.error('Erro ao buscar cidades:', error);
    return [];
  }
}

/**
 * Normaliza string para comparação (remove acentos e converte para minúsculas)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Cache de cidades para melhorar performance
 */
let citiesCache: CityOption[] | null = null;

/**
 * Busca cidades com cache
 */
export async function searchCitiesWithCache(query: string): Promise<CityOption[]> {
  try {
    if (!query || query.length < 2) {
      return [];
    }

    // Se não tem cache, busca todas as cidades
    if (!citiesCache) {
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome`
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar cidades');
      }

      const data: IBGECity[] = await response.json();
      
      citiesCache = data.map((city) => ({
        id: city.id.toString(),
        name: city.nome,
        state: city.microrregiao?.mesorregiao?.UF?.sigla || 'BR',
        displayName: `${city.nome} - ${city.microrregiao?.mesorregiao?.UF?.sigla || 'BR'}`,
      }));
    }

    // Filtra no cache
    const normalizedQuery = normalizeString(query);
    
    return citiesCache
      .filter((city) => {
        const cityName = normalizeString(city.name);
        return cityName.includes(normalizedQuery);
      })
      .slice(0, 10);
  } catch (error) {
    console.error('Erro ao buscar cidades:', error);
    return [];
  }
}
