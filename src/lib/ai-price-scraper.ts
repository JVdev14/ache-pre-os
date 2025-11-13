// Sistema de busca de preços usando IA (OpenAI GPT-4)
import OpenAI from 'openai';

// Verifica se a API key está configurada
const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

const openai = apiKey ? new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true, // Para uso no cliente
}) : null;

export interface RealPriceData {
  productName: string;
  price: number;
  source: string; // Instagram, Facebook, Site, etc.
  lastUpdated: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface StoreWithRealPrices {
  storeName: string;
  storeType: string;
  address: string;
  socialMedia: {
    instagram?: string;
    facebook?: string;
    website?: string;
  };
  prices: RealPriceData[];
  lastScraped: string;
}

/**
 * Busca preços reais usando IA para pesquisar nas redes sociais e sites
 */
export async function fetchRealPricesWithAI(
  storeName: string,
  storeType: string,
  city: string
): Promise<StoreWithRealPrices | null> {
  // Verifica se a API key está configurada
  if (!openai || !apiKey) {
    console.warn('⚠️ OpenAI API key não configurada. Configure NEXT_PUBLIC_OPENAI_API_KEY para usar preços reais com IA.');
    return null;
  }

  try {
    const prompt = `
Você é um assistente especializado em encontrar preços de produtos em estabelecimentos comerciais.

TAREFA: Pesquise e retorne preços REAIS e ATUALIZADOS do estabelecimento "${storeName}" (tipo: ${storeType}) localizado em ${city}.

INSTRUÇÕES:
1. Busque informações em redes sociais (Instagram, Facebook) e sites do estabelecimento
2. Procure por posts recentes com preços de produtos
3. Identifique promoções e ofertas atuais
4. Retorne APENAS preços que você encontrou com ALTA CONFIANÇA

FORMATO DE RESPOSTA (JSON):
{
  "storeName": "${storeName}",
  "storeType": "${storeType}",
  "socialMedia": {
    "instagram": "URL ou @usuario (se encontrado)",
    "facebook": "URL (se encontrado)",
    "website": "URL (se encontrado)"
  },
  "prices": [
    {
      "productName": "Nome exato do produto",
      "price": 0.00,
      "source": "Instagram/Facebook/Site",
      "lastUpdated": "Data da postagem/atualização",
      "confidence": "high/medium/low"
    }
  ]
}

IMPORTANTE:
- Se NÃO encontrar preços reais, retorne array "prices" VAZIO
- NÃO invente preços - apenas retorne o que você realmente encontrou
- Priorize informações recentes (últimos 30 dias)
- Seja preciso com os valores

Retorne APENAS o JSON, sem texto adicional.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente que busca preços reais de produtos em estabelecimentos comerciais através de pesquisa online. Retorne APENAS dados verificáveis e precisos.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Baixa temperatura para respostas mais precisas
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    const data: StoreWithRealPrices = JSON.parse(content);
    data.lastScraped = new Date().toISOString();

    // Filtra apenas preços com confiança alta ou média
    data.prices = data.prices.filter(
      (price) => price.confidence === 'high' || price.confidence === 'medium'
    );

    return data;
  } catch (error) {
    console.error('Erro ao buscar preços com IA:', error);
    return null;
  }
}

/**
 * Busca preços para múltiplos estabelecimentos em paralelo
 */
export async function fetchMultipleStoresPrices(
  stores: Array<{ name: string; type: string }>,
  city: string
): Promise<StoreWithRealPrices[]> {
  // Verifica se a API key está configurada
  if (!openai || !apiKey) {
    console.warn('⚠️ OpenAI API key não configurada. Configure NEXT_PUBLIC_OPENAI_API_KEY para usar preços reais com IA.');
    return [];
  }

  const promises = stores.map((store) =>
    fetchRealPricesWithAI(store.name, store.type, city)
  );

  const results = await Promise.allSettled(promises);

  return results
    .filter((result) => result.status === 'fulfilled' && result.value !== null)
    .map((result) => (result as PromiseFulfilledResult<StoreWithRealPrices>).value);
}

/**
 * Busca preços específicos de produtos usando IA
 */
export async function searchSpecificProductPrices(
  productName: string,
  storeNames: string[],
  city: string
): Promise<RealPriceData[]> {
  // Verifica se a API key está configurada
  if (!openai || !apiKey) {
    console.warn('⚠️ OpenAI API key não configurada. Configure NEXT_PUBLIC_OPENAI_API_KEY para usar preços reais com IA.');
    return [];
  }

  try {
    const storeList = storeNames.join(', ');
    const prompt = `
Pesquise o preço atual do produto "${productName}" nos seguintes estabelecimentos em ${city}:
${storeList}

Busque em:
- Redes sociais (Instagram, Facebook)
- Sites e e-commerces dos estabelecimentos
- Posts recentes com preços

Retorne APENAS preços REAIS que você encontrou.

FORMATO JSON:
{
  "prices": [
    {
      "productName": "${productName}",
      "price": 0.00,
      "source": "Nome do estabelecimento + fonte (ex: Mercado X - Instagram)",
      "lastUpdated": "Data",
      "confidence": "high/medium/low"
    }
  ]
}

Se não encontrar preços reais, retorne array vazio.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Você busca preços reais de produtos específicos em estabelecimentos. Retorne apenas dados verificáveis.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    const data = JSON.parse(content);
    return data.prices.filter(
      (price: RealPriceData) =>
        price.confidence === 'high' || price.confidence === 'medium'
    );
  } catch (error) {
    console.error('Erro ao buscar preços específicos:', error);
    return [];
  }
}

/**
 * Verifica se a API key está configurada
 */
export function isAIConfigured(): boolean {
  return !!apiKey;
}
