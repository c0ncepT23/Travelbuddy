/**
 * Gemini Direct URL Service
 * 
 * Analyzes YouTube videos directly via URL without downloading.
 * Used for Shorts and when transcript is unavailable.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
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
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const contextInfo = options?.title ? `\nVideo title: "${options.title}"` : '';
      const descInfo = options?.description ? `\nDescription: "${options.description}"` : '';

      const prompt = `Analyze this YouTube video and extract ALL travel-related places mentioned or shown.
${contextInfo}${descInfo}

For each place, identify:
1. name: The specific place name (restaurant, cafe, attraction - NOT generic landmarks unless they ARE the destination)
2. category: One of [food, accommodation, place, shopping, activity, tip]
3. description: What makes this place special (from video context)
4. location: City or area (if mentioned)
5. parent_location: If this place is INSIDE a larger landmark (e.g., cafe inside a mall), specify the container
6. cuisine_type: For restaurants/cafes only
7. place_type: Specific type (e.g., "ramen shop", "vintage store", "observation deck")
8. tags: Relevant tags ["instagrammable", "budget-friendly", "must-visit", etc.]

IMPORTANT: Apply the "Star Venue" rule - if a cafe is inside a famous mall, the cafe is the star (primary place), the mall is just parent_location metadata.

Return JSON:
{
  "summary": "Brief summary of what this video is about",
  "destination": "Main city/destination",
  "destination_country": "Country name",
  "places": [
    {
      "name": "Golden Cheese Cafe",
      "category": "food",
      "description": "Famous for cheese-pull toast",
      "location": "Yeouido, Seoul",
      "parent_location": "The Hyundai Seoul",
      "cuisine_type": "cafe",
      "place_type": "korean cafe",
      "tags": ["instagrammable", "trendy"]
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

      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);

      logger.info(`[GeminiDirectUrl] Extracted ${parsed.places?.length || 0} places`);
      return parsed;

    } catch (error: any) {
      logger.error(`[GeminiDirectUrl] Analysis failed: ${error.message}`);
      throw error;
    }
  }
}

