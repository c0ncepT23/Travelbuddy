/**
 * Gemini Direct URL Service
 * 
 * Analyzes YouTube videos directly via URL without downloading.
 * Used for Shorts and when transcript is unavailable.
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { MODELS } from './gemini.service';
import config from '../config/env';
import logger from '../config/logger';
import { ItemCategory } from '../types';

interface ExtractedPlace {
  name: string;
  category: ItemCategory;
  description: string;
  location?: string;
  parent_location?: string;
  cuisine_type?: string;
  place_type?: string;
  tags?: string[];
}

// JSON Schema for YouTube Direct Extraction
const youtubeExtractionSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    destination: { type: SchemaType.STRING, nullable: true },
    destination_country: { type: SchemaType.STRING, nullable: true },
    places: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING, enum: ['food', 'accommodation', 'place', 'shopping', 'activity', 'tip'] },
          description: { type: SchemaType.STRING },
          location: { type: SchemaType.STRING, nullable: true },
          cuisine_type: { type: SchemaType.STRING, nullable: true },
          place_type: { type: SchemaType.STRING, nullable: true },
          tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true }
        },
        required: ['name', 'category', 'description']
      }
    }
  },
  required: ['summary', 'places']
};

export class GeminiDirectUrlService {
  private static genAI = new GoogleGenerativeAI(config.gemini.apiKey);

  /**
   * Analyze YouTube video directly via URL
   * No downloading, no temp files, no FileManager
   */
  static async analyzeYouTubeVideo(
    videoUrl: string,
    options?: {
      title?: string;
      description?: string;
    }
  ): Promise<{
    summary: string;
    destination?: string;
    destination_country?: string;
    places: ExtractedPlace[];
  }> {
    try {
      logger.info(`[GeminiDirectUrl] Analyzing video: ${videoUrl}`);

      const model = this.genAI.getGenerativeModel({
        model: MODELS.FLASH,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: youtubeExtractionSchema as any,
        },
      });

      const contextInfo = options?.title ? `\nVideo title: "${options.title}"` : '';
      const descInfo = options?.description ? `\nDescription: "${options.description}"` : '';

      const prompt = `Analyze this YouTube video and extract only the MAJOR geographical locations (Hero Places) visited.
${contextInfo}${descInfo}

RULES FOR EXTRACTION:
1. Identify the "HERO" locations: These are the main destinations the creator actually spent time at.
2. ONE PIN PER COMPLEX: If the video shows multiple spots inside a single complex (e.g., "Giraffe Terrace" or "Blossom Restaurant" inside "Safari World"), do NOT create separate entries for them. 
3. RICH & CRISP DESCRIPTIONS: Instead, create ONE entry for the Parent Place (e.g., "Safari World Bangkok") and put all the specific spots, food items, and tips into the "description" field.
4. FORMATTING RULE: 
   - NEVER use HTML tags (<ul>, <li>, <b>, etc.).
   - Use clean Markdown-style bullet points (•).
   - Use Title Case for sub-sections followed by a colon (e.g., "Highlights:", "Food to Try:").
   - Add a newline between sections to keep it readable.
5. IGNORE TRANSIT POINTS: Do not extract pickup points, meeting spots, or airports (e.g., "Central World" used as a tour bus pickup) unless they are an actual destination visited.

For each Hero Place, identify:
1. name: The official name of the Major Place (e.g., "Safari World Bangkok").
2. category: One of [food, accommodation, place, shopping, activity, tip].
3. description: A rich, crisp summary including all sub-locations and tips. Example:
   "Large open zoo and marine park.
   
   Highlights:
   • Giraffe Terrace: Best spot for photos (feeding 150 THB)
   • Dolphin Show: Arrive 20 mins early.
   
   Food to Try:
   • Blossom Restaurant: Lunch buffet included in most packages."
4. location: City or area.
5. cuisine_type: Only if the Hero Place is primarily a restaurant.
6. place_type: Specific type (e.g., "Theme Park", "Shopping Mall").
7. tags: Relevant tags.

Return JSON:
{
  "summary": "Brief summary of the video",
  "destination": "Main city",
  "destination_country": "Country",
  "places": [
    {
      "name": "Safari World Bangkok",
      "category": "place",
      "description": "Large open zoo and marine park. Highlights:\n• Giraffe Terrace: Best spot for photos (feeding 150 THB)\n• Blossom Restaurant: Lunch buffet included in most tour packages\n• Arrive 20 mins early for the Dolphin Show.",
      "location": "Khlong Sam Wa, Bangkok",
      "place_type": "zoo",
      "tags": ["family-friendly", "must-visit", "shows"]
    }
  ]
}`;

      const result = await model.generateContent([
        {
          fileData: {
            fileUri: videoUrl,
            mimeType: 'video/youtube',
          },
        },
        prompt,
      ]);

      const parsed = JSON.parse(result.response.text());

      logger.info(`[GeminiDirectUrl] Extracted ${parsed.places?.length || 0} places`);
      return parsed;

    } catch (error: any) {
      logger.error(`[GeminiDirectUrl] Analysis failed: ${error.message}`);
      throw error;
    }
  }
}

