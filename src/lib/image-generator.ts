// Geração de imagens com IA usando DALL-E (OpenAI)

import OpenAI from 'openai';

const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

const openai = apiKey ? new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true,
}) : null;

export interface GeneratedImage {
  url: string;
  prompt: string;
  createdAt: string;
}

/**
 * Gera imagem ilustrativa de um tipo de estabelecimento usando DALL-E
 */
export async function generateEstablishmentImage(
  establishmentType: string
): Promise<GeneratedImage | null> {
  if (!openai || !apiKey) {
    console.warn('⚠️ OpenAI API key não configurada. Configure NEXT_PUBLIC_OPENAI_API_KEY para gerar imagens.');
    return null;
  }

  try {
    // Prompts otimizados para cada tipo de estabelecimento
    const prompts: Record<string, string> = {
      'Mercado': 'A modern, clean supermarket interior with colorful fresh produce displays, shopping carts, and bright lighting. Photorealistic, professional photography style.',
      'Farmácia': 'A modern pharmacy interior with organized medicine shelves, a clean counter, and professional healthcare atmosphere. Photorealistic, bright and welcoming.',
      'Lanchonete': 'A cozy fast food restaurant interior with counter service, menu boards, and casual dining area. Modern, inviting atmosphere. Photorealistic.',
      'Cafeteria': 'A stylish coffee shop interior with espresso machine, pastry display, wooden tables, and warm lighting. Cozy and modern. Photorealistic.',
      'Padaria': 'A traditional bakery interior with fresh bread displays, pastries, and warm golden lighting. Inviting and aromatic atmosphere. Photorealistic.',
      'Restaurante': 'An elegant restaurant interior with set tables, ambient lighting, and sophisticated decor. Fine dining atmosphere. Photorealistic.',
      'Loja': 'A modern retail store interior with organized product displays, clean aisles, and bright lighting. Professional and inviting. Photorealistic.',
    };

    const prompt = prompts[establishmentType] || prompts['Loja'];

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural',
    });

    const imageUrl = response.data[0]?.url;

    if (!imageUrl) {
      return null;
    }

    return {
      url: imageUrl,
      prompt: prompt,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Erro ao gerar imagem com DALL-E:', error);
    return null;
  }
}

/**
 * Gera múltiplas imagens para diferentes tipos de estabelecimento
 */
export async function generateMultipleEstablishmentImages(
  types: string[]
): Promise<Record<string, GeneratedImage>> {
  if (!openai || !apiKey) {
    console.warn('⚠️ OpenAI API key não configurada.');
    return {};
  }

  const results: Record<string, GeneratedImage> = {};

  // Gera imagens sequencialmente para evitar rate limits
  for (const type of types) {
    const image = await generateEstablishmentImage(type);
    if (image) {
      results[type] = image;
    }
    // Pequeno delay entre requisições
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

/**
 * Gera imagem customizada com prompt específico
 */
export async function generateCustomImage(
  prompt: string,
  size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024'
): Promise<GeneratedImage | null> {
  if (!openai || !apiKey) {
    console.warn('⚠️ OpenAI API key não configurada.');
    return null;
  }

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size,
      quality: 'standard',
      style: 'natural',
    });

    const imageUrl = response.data[0]?.url;

    if (!imageUrl) {
      return null;
    }

    return {
      url: imageUrl,
      prompt: prompt,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Erro ao gerar imagem customizada:', error);
    return null;
  }
}

/**
 * Verifica se a geração de imagens está configurada
 */
export function isImageGenerationConfigured(): boolean {
  return !!apiKey;
}
