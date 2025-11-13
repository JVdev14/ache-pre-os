// Serviço de busca de estabelecimentos usando OpenStreetMap + IA para preços reais

import { Coordinates, calculateDistance } from './geolocation';
import { fetchRealPricesWithAI, isAIConfigured, type StoreWithRealPrices } from './ai-price-scraper';

export interface Place {
  id: string;
  name: string;
  type: string;
  category: string;
  distance: number;
  address: string;
  coordinates: Coordinates;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  store: string;
  distance: string;
  category: string;
  source?: string; // Fonte do preço (Instagram, Facebook, Site)
  lastUpdated?: string; // Data da última atualização
  confidence?: 'high' | 'medium' | 'low'; // Confiança no preço
  isReal?: boolean; // Se é preço real ou mockado
}

export interface StoreWithProducts extends Place {
  products: Product[];
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    website?: string;
  };
}

// Mapeamento de categorias para tags do OpenStreetMap
const CATEGORY_TAGS: Record<string, string[]> = {
  'Mercado': ['supermarket', 'convenience', 'grocery'],
  'Farmácia': ['pharmacy', 'chemist'],
  'Lanchonete': ['fast_food', 'restaurant'],
  'Cafeteria': ['cafe', 'coffee_shop'],
  'Padaria': ['bakery'],
  'Restaurante': ['restaurant'],
};

/**
 * Busca estabelecimentos próximos usando Overpass API (OpenStreetMap)
 */
export async function searchNearbyPlaces(
  coordinates: Coordinates,
  radiusKm: number = 5
): Promise<Place[]> {
  try {
    // Constrói query Overpass para buscar múltiplos tipos de estabelecimentos
    const tags = Object.values(CATEGORY_TAGS).flat();
    const tagQueries = tags.map(tag => `node["shop"="${tag}"](around:${radiusKm * 1000},${coordinates.lat},${coordinates.lng});`).join('');
    const amenityQueries = tags.map(tag => `node["amenity"="${tag}"](around:${radiusKm * 1000},${coordinates.lat},${coordinates.lng});`).join('');
    
    const query = `
      [out:json][timeout:25];
      (
        ${tagQueries}
        ${amenityQueries}
      );
      out body;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });

    if (!response.ok) {
      throw new Error('Erro ao buscar estabelecimentos');
    }

    const data = await response.json();
    
    // Processa resultados
    const places: Place[] = data.elements
      .filter((element: any) => element.tags?.name) // Apenas com nome
      .map((element: any) => {
        const placeCoords: Coordinates = {
          lat: element.lat,
          lng: element.lon,
        };

        const distance = calculateDistance(coordinates, placeCoords);
        const category = getCategoryFromTags(element.tags);

        return {
          id: element.id.toString(),
          name: element.tags.name,
          type: category,
          category: category,
          distance: distance,
          address: formatAddress(element.tags),
          coordinates: placeCoords,
        };
      })
      .sort((a: Place, b: Place) => a.distance - b.distance) // Ordena por distância
      .slice(0, 20); // Limita a 20 resultados

    return places;
  } catch (error) {
    console.error('Erro ao buscar estabelecimentos:', error);
    // Retorna dados mockados em caso de erro
    return getMockPlaces(coordinates);
  }
}

/**
 * Determina categoria do estabelecimento baseado nas tags
 */
function getCategoryFromTags(tags: any): string {
  const shop = tags.shop;
  const amenity = tags.amenity;

  for (const [category, tagList] of Object.entries(CATEGORY_TAGS)) {
    if (tagList.includes(shop) || tagList.includes(amenity)) {
      return category;
    }
  }

  return 'Outros';
}

/**
 * Formata endereço a partir das tags
 */
function formatAddress(tags: any): string {
  const parts = [];
  
  if (tags['addr:street']) parts.push(tags['addr:street']);
  if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
  if (tags['addr:neighbourhood']) parts.push(tags['addr:neighbourhood']);
  if (tags['addr:city']) parts.push(tags['addr:city']);

  return parts.length > 0 ? parts.join(', ') : 'Endereço não disponível';
}

/**
 * Adiciona produtos com PREÇOS REAIS usando IA aos estabelecimentos
 * SEMPRE tenta buscar preços reais primeiro
 */
export async function addRealProductsToPlaces(
  places: Place[],
  city: string
): Promise<StoreWithProducts[]> {
  const storesWithProducts: StoreWithProducts[] = [];

  // Processa estabelecimentos em lotes para não sobrecarregar a API
  const batchSize = 5; // Aumentado para processar mais lojas
  for (let i = 0; i < places.length; i += batchSize) {
    const batch = places.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (place) => {
      try {
        console.log(`🔍 Buscando preços reais para: ${place.name} (${place.type}) em ${city}`);
        
        // Busca preços reais com IA
        const realPrices = await fetchRealPricesWithAI(place.name, place.type, city);
        
        if (realPrices && realPrices.prices.length > 0) {
          console.log(`✅ Encontrados ${realPrices.prices.length} preços reais para ${place.name}`);
          
          // Converte para formato Product
          const products: Product[] = realPrices.prices.map((priceData, index) => ({
            id: `${place.id}-${index}`,
            name: priceData.productName,
            price: priceData.price,
            store: place.name,
            distance: `${place.distance} km`,
            category: place.type,
            source: priceData.source,
            lastUpdated: priceData.lastUpdated,
            confidence: priceData.confidence,
            isReal: true,
          }));

          return {
            ...place,
            products,
            socialMedia: realPrices.socialMedia,
          };
        } else {
          console.log(`⚠️ Nenhum preço real encontrado para ${place.name}, usando produtos genéricos`);
          // Se não encontrou preços reais, usa produtos genéricos do tipo de estabelecimento
          return {
            ...place,
            products: generateRealisticProducts(place),
          };
        }
      } catch (error) {
        console.error(`❌ Erro ao buscar preços para ${place.name}:`, error);
        return {
          ...place,
          products: generateRealisticProducts(place),
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    storesWithProducts.push(...batchResults);
  }

  return storesWithProducts;
}

/**
 * Adiciona produtos mockados aos estabelecimentos (fallback)
 */
export function addMockProductsToPlaces(places: Place[]): StoreWithProducts[] {
  return places.map(place => ({
    ...place,
    products: generateRealisticProducts(place),
  }));
}

/**
 * Gera produtos REALISTAS e VARIADOS baseado no tipo de estabelecimento
 * Cada loja terá produtos diferentes para evitar repetição
 */
function generateRealisticProducts(place: Place): Product[] {
  // Produtos mais realistas e variados por categoria
  const productsByCategory: Record<string, Array<{ name: string; basePrice: number }>> = {
    'Mercado': [
      { name: 'Arroz Tipo 1 5kg', basePrice: 24.90 },
      { name: 'Feijão Carioca 1kg', basePrice: 8.50 },
      { name: 'Óleo de Soja 900ml', basePrice: 7.90 },
      { name: 'Açúcar Cristal 1kg', basePrice: 4.90 },
      { name: 'Café Torrado 500g', basePrice: 14.90 },
      { name: 'Leite Integral 1L', basePrice: 5.50 },
      { name: 'Macarrão Espaguete 500g', basePrice: 3.90 },
      { name: 'Farinha de Trigo 1kg', basePrice: 5.50 },
      { name: 'Sal Refinado 1kg', basePrice: 2.50 },
      { name: 'Molho de Tomate 340g', basePrice: 3.20 },
    ],
    'Farmácia': [
      { name: 'Dipirona Sódica 500mg', basePrice: 9.90 },
      { name: 'Vitamina C 1g', basePrice: 18.50 },
      { name: 'Protetor Solar FPS 50', basePrice: 48.90 },
      { name: 'Paracetamol 750mg', basePrice: 11.50 },
      { name: 'Álcool Gel 70% 500ml', basePrice: 14.90 },
      { name: 'Ibuprofeno 600mg', basePrice: 15.90 },
      { name: 'Esmalte Colorido', basePrice: 7.90 },
      { name: 'Shampoo Anticaspa 400ml', basePrice: 22.90 },
      { name: 'Fralda Descartável M', basePrice: 42.90 },
      { name: 'Termômetro Digital', basePrice: 28.90 },
    ],
    'Lanchonete': [
      { name: 'X-Burger Artesanal', basePrice: 22.90 },
      { name: 'Refrigerante Lata 350ml', basePrice: 6.50 },
      { name: 'Batata Frita Grande', basePrice: 15.90 },
      { name: 'Hot Dog Completo', basePrice: 12.50 },
      { name: 'Suco Natural 500ml', basePrice: 10.90 },
      { name: 'X-Salada', basePrice: 18.90 },
      { name: 'Milk Shake', basePrice: 14.90 },
      { name: 'Porção de Onion Rings', basePrice: 16.90 },
      { name: 'Sanduíche Natural', basePrice: 11.90 },
      { name: 'Açaí 500ml', basePrice: 18.90 },
    ],
    'Cafeteria': [
      { name: 'Café Expresso', basePrice: 7.50 },
      { name: 'Cappuccino Tradicional', basePrice: 11.90 },
      { name: 'Pão de Queijo', basePrice: 5.50 },
      { name: 'Croissant Recheado', basePrice: 9.90 },
      { name: 'Bolo Caseiro Fatia', basePrice: 10.50 },
      { name: 'Café com Leite', basePrice: 8.90 },
      { name: 'Brownie', basePrice: 12.90 },
      { name: 'Torta de Limão', basePrice: 14.90 },
      { name: 'Cookie Chocolate', basePrice: 6.90 },
      { name: 'Chá Gelado 500ml', basePrice: 9.90 },
    ],
    'Padaria': [
      { name: 'Pão Francês (kg)', basePrice: 14.90 },
      { name: 'Pão de Forma Integral', basePrice: 9.50 },
      { name: 'Bolo de Chocolate', basePrice: 28.90 },
      { name: 'Sonho Recheado', basePrice: 6.50 },
      { name: 'Empada de Frango', basePrice: 7.90 },
      { name: 'Pão de Queijo', basePrice: 4.90 },
      { name: 'Torta Salgada', basePrice: 32.90 },
      { name: 'Biscoito Caseiro (kg)', basePrice: 24.90 },
      { name: 'Croissant', basePrice: 8.90 },
      { name: 'Baguete', basePrice: 6.90 },
    ],
  };

  const products = productsByCategory[place.type] || productsByCategory['Mercado'];
  
  // Seleciona 3-5 produtos ALEATÓRIOS para cada loja (evita repetição)
  const numProducts = 3 + Math.floor(Math.random() * 3); // 3 a 5 produtos
  const shuffled = [...products].sort(() => Math.random() - 0.5);
  const selectedProducts = shuffled.slice(0, numProducts);
  
  // Adiciona variação de preço realista (-15% a +25%)
  return selectedProducts.map((product, index) => {
    const variation = 0.85 + Math.random() * 0.4; // 0.85 a 1.25
    const price = product.basePrice * variation;

    return {
      id: `${place.id}-${index}`,
      name: product.name,
      price: Math.round(price * 100) / 100,
      store: place.name,
      distance: `${place.distance} km`,
      category: place.type,
      isReal: false,
    };
  });
}

/**
 * Dados mockados para fallback
 */
function getMockPlaces(coordinates: Coordinates): Place[] {
  const mockData = [
    { name: 'Supermercado Economia', type: 'Mercado', baseDistance: 0.5 },
    { name: 'Farmácia Saúde+', type: 'Farmácia', baseDistance: 0.8 },
    { name: 'Lanchonete Sabor & Cia', type: 'Lanchonete', baseDistance: 1.2 },
    { name: 'Mercado Preço Bom', type: 'Mercado', baseDistance: 1.5 },
    { name: 'Café Aroma', type: 'Cafeteria', baseDistance: 0.3 },
    { name: 'Padaria Pão Quente', type: 'Padaria', baseDistance: 0.6 },
    { name: 'Farmácia Popular', type: 'Farmácia', baseDistance: 1.0 },
    { name: 'Restaurante Bom Sabor', type: 'Restaurante', baseDistance: 0.9 },
  ];

  return mockData.map((item, index) => ({
    id: `mock-${index}`,
    name: item.name,
    type: item.type,
    category: item.type,
    distance: item.baseDistance,
    address: `Rua Exemplo, ${100 + index * 50}`,
    coordinates: {
      lat: coordinates.lat + (Math.random() - 0.5) * 0.02,
      lng: coordinates.lng + (Math.random() - 0.5) * 0.02,
    },
  }));
}
