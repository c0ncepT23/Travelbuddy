import axios from 'axios';
import { config } from '../config/env';
import logger from '../config/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DiscoveryIntent } from '../types';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

export interface ScoutResult {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  user_rating_count?: number;
  generative_summary?: string;
  vibe_match_score: number; // 0-10
  social_label: 'Local Favorite' | 'Trending' | 'Legendary' | 'Tourist Trap';
  photos?: any[];
  location: {
    lat: number;
    lng: number;
  };
}

export class ScoutService {
  private static readonly API_KEY = config.googleMaps.apiKey;
  private static readonly BASE_URL = 'https://places.googleapis.com/v1';

  /**
   * Scout for places matching a culinary or activity goal
   */
  static async scout(intent: DiscoveryIntent): Promise<ScoutResult[]> {
    try {
      if (!this.API_KEY) {
        logger.warn('[ScoutService] Google Maps API Key missing');
        return [];
      }

      logger.info(`🔍 [ScoutService] Starting scout for: "${intent.scout_query}" in ${intent.city}`);

      // Step 1: Text Search (New) to find candidates
      const searchResults = await this.textSearch(intent.scout_query);
      if (searchResults.length === 0) {
        logger.info('[ScoutService] No candidates found via search');
        return [];
      }

      // Step 2: Get rich details including summaries for top 10
      const candidates = await Promise.all(
        searchResults.slice(0, 10).map(place => this.getRichDetails(place.id))
      );

      // Step 3: Reranking magic with Gemini
      const reranked = await this.rerankWithGemini(intent, candidates.filter(c => c !== null) as any[]);
      
      logger.info(`✨ [ScoutService] Successfully scouted ${reranked.length} matches`);
      return reranked;
    } catch (error: any) {
      logger.error('[ScoutService] Scout error:', error.message);
      return [];
    }
  }

  private static async textSearch(query: string): Promise<Array<{ id: string }>> {
    try {
      const response = await axios.post(
        `${this.BASE_URL}/places:searchText`,
        { textQuery: query },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.API_KEY,
            'X-Goog-FieldMask': 'places.id',
          },
        }
      );

      return response.data.places || [];
    } catch (error: any) {
      logger.error('[ScoutService] Text search error:', error.response?.data || error.message);
      return [];
    }
  }

  private static async getRichDetails(placeId: string): Promise<any | null> {
    try {
      const response = await axios.get(
        `${this.BASE_URL}/places/${placeId}`,
        {
          headers: {
            'X-Goog-Api-Key': this.API_KEY,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,userRatingCount,generativeSummary,editorialSummary,photos,location,types,reviews',
          },
        }
      );

      const place = response.data;
      return {
        id: place.id,
        name: place.displayName?.text,
        address: place.formattedAddress,
        rating: place.rating,
        user_rating_count: place.userRatingCount,
        generative_summary: place.generativeSummary?.overview?.text || place.editorialSummary?.text,
        location: {
          lat: place.location?.latitude,
          lng: place.location?.longitude,
        },
        reviews: (place.reviews || []).slice(0, 5).map((r: any) => r.text?.text),
        photos: place.photos,
      };
    } catch (error: any) {
      logger.error(`[ScoutService] Detail fetch error for ${placeId}:`, error.message);
      return null;
    }
  }

  private static async rerankWithGemini(intent: DiscoveryIntent, candidates: any[]): Promise<ScoutResult[]> {
    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        }
      });

      const prompt = `You are a social intelligence travel agent.
The user saw a video about "${intent.item}" in ${intent.city}.
Vibe target: ${intent.vibe}

Here are 10 candidates from Google Places. Pick the top 3-5 that best match the vibe.
Identify if they are "Local Favorites" (high rating, lower count), "Legends" (massive review count), "Trending" (recent buzz in summaries), or "Tourist Traps".

Candidates:
${JSON.stringify(candidates.map(c => ({
  id: c.id,
  name: c.name,
  rating: c.rating,
  reviews_count: c.user_rating_count,
  summary: c.generative_summary,
  review_snippets: (c.reviews || []).slice(0, 2)
})), null, 2)}

Respond with JSON:
{
  "matches": [
    {
      "id": "place_id",
      "vibe_score": 0-10,
      "social_label": "Local Favorite" | "Trending" | "Legendary" | "Tourist Trap",
      "reasoning": "Why this matches the video's vibe"
    }
  ]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      let cleanText = text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      const parsed = JSON.parse(cleanText);
      
      // Map back to candidates
      return (parsed.matches || [])
        .map((match: any) => {
          const candidate = candidates.find(c => c.id === match.id);
          if (!candidate) return null;
          
          return {
            ...candidate,
            place_id: candidate.id,
            vibe_match_score: match.vibe_score,
            social_label: match.social_label,
            generative_summary: match.reasoning || candidate.generative_summary,
          };
        })
        .filter((r: any) => r !== null)
        .sort((a: any, b: any) => b.vibe_match_score - a.vibe_match_score);
    } catch (error: any) {
      logger.error('[ScoutService] Gemini reranking error:', error.message);
      // Fallback: just return the first 3
      return candidates.slice(0, 3).map(c => ({
        ...c,
        place_id: c.id,
        vibe_match_score: 8,
        social_label: 'Trending',
      })) as any;
    }
  }
}

