import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import { ItemCategory } from '../types';
import logger from '../config/logger';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

export class GeminiService {
  /**
   * Analyze YouTube video and extract places with summary
   */
  static async analyzeYouTubeVideo(
    videoUrl: string
  ): Promise<{
    summary: string;
    places: Array<{
      name: string;
      category: ItemCategory;
      description: string;
      location?: string;
    }>;
  }> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Analyze this YouTube video: ${videoUrl}

Please provide:
1. A brief summary of the video (2-3 sentences)
2. Extract ALL specific places, restaurants, shops, or locations mentioned in the video

For each place, provide:
- Name (exact name of the place)
- Category (choose ONE: food, accommodation, place, shopping, activity, tip)
- Description (1-2 sentences about what makes it special)
- Location (city/area if mentioned)

Respond ONLY with valid JSON in this format:
{
  "summary": "Brief video summary here",
  "places": [
    {
      "name": "Place Name",
      "category": "food",
      "description": "What makes it special",
      "location": "City or area"
    }
  ]
}

If it's a list video (like "Top 10 Restaurants"), extract each individual place.
If no specific places are mentioned, return an empty places array but still provide the summary.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse Gemini response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      logger.info(`Gemini analyzed video: Found ${parsed.places?.length || 0} places`);

      return {
        summary: parsed.summary || 'No summary available',
        places: parsed.places || [],
      };
    } catch (error: any) {
      logger.error('Gemini YouTube analysis error:', error);
      throw new Error(`Failed to analyze video: ${error.message}`);
    }
  }

  /**
   * Fallback: Analyze video from title and description
   * Now also extracts:
   * - destination (country/city for auto-grouping)
   * - cuisine_type (for food items: ramen, wagyu, sushi, etc.)
   * - place_type (for places: temple, shrine, market, viewpoint, etc.)
   * - tags (additional descriptive tags for sub-clustering)
   */
  static async analyzeVideoMetadata(
    title: string,
    description: string,
    transcript?: string
  ): Promise<{
    summary: string;
    video_type: 'places' | 'howto' | 'guide';
    destination?: string;  // Country or City, e.g., "Japan", "Tokyo", "Paris"
    destination_country?: string;  // Always the country, e.g., "Japan"
    duration_days?: number;
    places: Array<{
      name: string;
      category: ItemCategory;
      description: string;
      location?: string;
      day?: number;
      // NEW: Sub-categorization fields
      cuisine_type?: string;  // For food: "ramen", "wagyu", "sushi", "cheesecake", etc.
      place_type?: string;    // For places: "temple", "shrine", "market", "viewpoint", etc.
      tags?: string[];        // Additional tags: ["michelin", "local favorite", "hidden gem"]
    }>;
    itinerary?: Array<{
      day: number;
      title: string;
      places: string[];
    }>;
  }> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      // Use transcript if available, otherwise fall back to description
      const contentToAnalyze = transcript && transcript.length > 0 
        ? `Transcript:\n${transcript.substring(0, 15000)}` // Limit to avoid token limits
        : `Description:\n${description}`;

      const prompt = `Analyze this YouTube travel video and determine its type, then extract relevant information.

Title: ${title}

${contentToAnalyze}

STEP 1 - CLASSIFY VIDEO TYPE:
Determine if this is a:

- **GUIDE/ITINERARY VIDEO**: Provides a day-by-day travel itinerary or trip plan
  Examples: "4 days in Bangkok", "Complete Tokyo itinerary", "One week Japan trip", "3 day Bali guide"
  Key indicators: mentions specific days (Day 1, Day 2), suggests a complete trip plan, has "itinerary" or "X days" in title

- **PLACES VIDEO**: Recommends specific restaurants, shops, attractions without a day-by-day structure
  Examples: "Best restaurants in Bangkok", "Top 10 things to do", "Hidden gems in Tokyo"

- **HOW-TO VIDEO**: Teaches tips, etiquette, or advice without recommending specific places
  Examples: "How to eat sushi", "Travel tips for Japan", "Things to avoid"

STEP 2 - EXTRACT DESTINATION:
ALWAYS extract the destination country and city/region:
- destination: The specific city or region (e.g., "Tokyo", "Kyoto", "Bangkok")
- destination_country: The country name (e.g., "Japan", "Thailand", "France")

STEP 3 - EXTRACT PLACES WITH SUB-CATEGORIES:
For EACH place, extract detailed categorization:

For FOOD items, identify cuisine_type:
- Japanese: "ramen", "sushi", "wagyu", "tempura", "udon", "yakitori", "izakaya", "kaiseki", "tonkatsu", "curry"
- Desserts: "cheesecake", "matcha sweets", "mochi", "ice cream", "cafe", "bakery"
- Street food: "takoyaki", "okonomiyaki", "gyoza", "street food"
- Drinks: "sake bar", "whisky bar", "coffee", "tea house"

For PLACE items, identify place_type:
- Cultural: "temple", "shrine", "castle", "palace", "museum", "gallery"
- Nature: "garden", "park", "viewpoint", "mountain", "beach", "onsen"
- Urban: "neighborhood", "street", "market", "station", "observation deck"
- Entertainment: "theme park", "arcade", "theater", "stadium"

For SHOPPING items, identify place_type:
- "department store", "mall", "vintage shop", "thrift store", "electronics", "fashion", "souvenir", "market"

Also add relevant tags like:
- ["michelin", "budget-friendly", "hidden gem", "local favorite", "instagram-worthy", "reservation needed"]

RESPOND ONLY WITH VALID JSON (no markdown, no extra text):
{
  "video_type": "guide" or "places" or "howto",
  "summary": "Brief summary",
  "destination": "Tokyo",
  "destination_country": "Japan",
  "duration_days": 4,
  "itinerary": [
    {
      "day": 1,
      "title": "Day theme/title",
      "places": ["Place 1", "Place 2"]
    }
  ],
  "places": [
    {
      "name": "Ichiran Ramen",
      "category": "food",
      "description": "Famous tonkotsu ramen chain with solo dining booths",
      "location": "Shibuya, Tokyo",
      "day": 1,
      "cuisine_type": "ramen",
      "tags": ["local favorite", "solo dining friendly"]
    },
    {
      "name": "Senso-ji Temple",
      "category": "place",
      "description": "Tokyo's oldest and most famous Buddhist temple",
      "location": "Asakusa, Tokyo",
      "day": 2,
      "place_type": "temple",
      "tags": ["iconic", "must-see", "free entry"]
    }
  ]
}

For GUIDE videos: Include both itinerary structure AND individual places with day numbers.
For PLACES videos: Just include places array, no itinerary.
For HOW-TO videos: Return empty places array.
ALWAYS include destination and destination_country even for places/howto videos.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Remove markdown code blocks if present
      let cleanText = text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const videoType = parsed.video_type || 'places';
      logger.info(`Gemini classified video as: ${videoType}`);
      logger.info(`Gemini extracted ${parsed.places?.length || 0} places from video metadata`);
      logger.info(`Destination: ${parsed.destination || 'Unknown'} (${parsed.destination_country || 'Unknown'})`);

      // Log sub-categorization stats
      const cuisineTypes = parsed.places?.filter((p: any) => p.cuisine_type).map((p: any) => p.cuisine_type);
      const placeTypes = parsed.places?.filter((p: any) => p.place_type).map((p: any) => p.place_type);
      if (cuisineTypes?.length > 0) {
        logger.info(`Cuisine types found: ${[...new Set(cuisineTypes)].join(', ')}`);
      }
      if (placeTypes?.length > 0) {
        logger.info(`Place types found: ${[...new Set(placeTypes)].join(', ')}`);
      }

      // For guide videos, include itinerary structure
      if (videoType === 'guide') {
        logger.info(`Guide video detected: ${parsed.duration_days} days in ${parsed.destination}`);
        logger.info(`Itinerary has ${parsed.itinerary?.length || 0} days`);
      }

      return {
        video_type: videoType,
        summary: parsed.summary || 'No summary available',
        places: parsed.places || [],
        itinerary: parsed.itinerary,
        destination: parsed.destination,
        destination_country: parsed.destination_country,
        duration_days: parsed.duration_days,
      };
    } catch (error: any) {
      logger.error('Gemini metadata analysis error:', error);
      throw new Error(`Failed to analyze metadata: ${error.message}`);
    }
  }

  /**
   * Analyze Reddit post and extract multiple places from comments
   * Now also extracts cuisine_type, place_type, tags, and destination
   */
  static async analyzeRedditPost(
    title: string,
    body: string,
    comments: string[]
  ): Promise<{
    summary: string;
    destination?: string;
    destination_country?: string;
    places: Array<{
      name: string;
      category: ItemCategory;
      description: string;
      location?: string;
      cuisine_type?: string;
      place_type?: string;
      tags?: string[];
    }>;
  }> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      // Combine comments into readable format
      const commentsText = comments.map((c, i) => `Comment ${i + 1}: ${c}`).join('\n\n');

      const prompt = `Analyze this Reddit travel discussion and extract ALL individual place recommendations.

Title: ${title}
Body: ${body}

Comments:
${commentsText}

IMPORTANT INSTRUCTIONS:
1. Look through ALL comments for specific restaurant/shop/place names
2. Extract EACH place individually - do not group them together
3. Each comment may mention multiple places - extract each one separately
4. Use the exact name as mentioned in the comments
5. If addresses or locations are provided, extract the area/neighborhood
6. ALWAYS determine the destination country and city from context

For FOOD items, identify cuisine_type:
- Japanese: "ramen", "sushi", "wagyu", "tempura", "udon", "yakitori", "izakaya", "kaiseki", "tonkatsu", "curry"
- Desserts: "cheesecake", "matcha sweets", "mochi", "ice cream", "cafe", "bakery"
- Street food: "takoyaki", "okonomiyaki", "gyoza", "street food"
- Thai: "pad thai", "curry", "street food", "seafood"
- General: "steakhouse", "fine dining", "casual dining", "fast food"

For PLACE items, identify place_type:
- Cultural: "temple", "shrine", "castle", "palace", "museum", "gallery"
- Nature: "garden", "park", "viewpoint", "mountain", "beach", "onsen"
- Urban: "neighborhood", "street", "market", "station", "observation deck"

For SHOPPING items, identify place_type:
- "department store", "mall", "vintage shop", "thrift store", "electronics", "fashion", "souvenir", "market"

Add relevant tags like:
- ["michelin", "budget-friendly", "hidden gem", "local favorite", "instagram-worthy", "reservation needed"]

RESPOND ONLY WITH VALID JSON (no markdown, no extra text):
{
  "summary": "Brief summary of the discussion",
  "destination": "Tokyo",
  "destination_country": "Japan",
  "places": [
    {
      "name": "Place Name",
      "category": "food",
      "description": "Specific details about this place",
      "location": "Area, City",
      "cuisine_type": "ramen",
      "tags": ["local favorite"]
    }
  ]
}

If a comment says "department stores like Daimaru or Parco", extract BOTH as separate entries.
If comments mention chains with specific names, extract the chain name.
If no specific places mentioned, return empty places array.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Remove markdown code blocks if present
      let cleanText = text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      logger.info(`Gemini extracted ${parsed.places?.length || 0} places from Reddit post`);
      logger.info(`Destination: ${parsed.destination || 'Unknown'} (${parsed.destination_country || 'Unknown'})`);

      return {
        summary: parsed.summary || 'No summary available',
        destination: parsed.destination,
        destination_country: parsed.destination_country,
        places: parsed.places || [],
      };
    } catch (error: any) {
      logger.error('Gemini Reddit analysis error:', error);
      throw new Error(`Failed to analyze Reddit post: ${error.message}`);
    }
  }

  /**
   * Analyze Instagram post (caption + image) and extract places
   * Now also extracts cuisine_type, place_type, tags, and destination
   */
  static async analyzeInstagramPost(
    caption: string,
    imageUrl?: string
  ): Promise<{
    summary: string;
    destination?: string;
    destination_country?: string;
    places: Array<{
      name: string;
      category: ItemCategory;
      description: string;
      location?: string;
      cuisine_type?: string;
      place_type?: string;
      tags?: string[];
    }>;
  }> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      // Note: For now we are only analyzing text, but we could add image analysis later
      // using the multimodal capabilities of Gemini Pro Vision
      
      const prompt = `Analyze this Instagram travel post (caption) and extract ALL individual place recommendations.

Caption:
${caption}

Image URL: ${imageUrl || 'Not available'}

IMPORTANT INSTRUCTIONS:
1. Identify the specific place/spot being recommended in the caption or hashtags
2. If the post recommends multiple places (e.g. "Top 5 Cafes in Paris"), extract EACH ONE separately
3. Look for location details in hashtags (e.g. #tokyofood, #shibuya)
4. Determine the vibe/category from the emojis and description
5. ALWAYS determine the destination country and city from context/hashtags

For FOOD items, identify cuisine_type:
- Japanese: "ramen", "sushi", "wagyu", "tempura", "udon", "yakitori", "izakaya", "kaiseki", "tonkatsu", "curry"
- Desserts: "cheesecake", "matcha sweets", "mochi", "ice cream", "cafe", "bakery"
- Street food: "takoyaki", "okonomiyaki", "gyoza", "street food"
- Thai: "pad thai", "curry", "street food", "seafood"
- General: "steakhouse", "fine dining", "casual dining", "brunch"

For PLACE items, identify place_type:
- Cultural: "temple", "shrine", "castle", "palace", "museum", "gallery"
- Nature: "garden", "park", "viewpoint", "mountain", "beach", "onsen"
- Urban: "neighborhood", "street", "market", "station", "observation deck"

For SHOPPING items, identify place_type:
- "department store", "mall", "vintage shop", "thrift store", "electronics", "fashion", "souvenir", "market"

Add relevant tags like:
- ["michelin", "budget-friendly", "hidden gem", "local favorite", "instagram-worthy", "reservation needed", "aesthetic"]

RESPOND ONLY WITH VALID JSON (no markdown, no extra text):
{
  "summary": "Brief summary of the post",
  "destination": "Tokyo",
  "destination_country": "Japan",
  "places": [
    {
      "name": "Place Name",
      "category": "food",
      "description": "Specific details about this place",
      "location": "Area, City",
      "cuisine_type": "cafe",
      "tags": ["instagram-worthy", "aesthetic"]
    }
  ]
}

If the caption is short or vague, try to infer as much as possible from hashtags.
If no specific place is mentioned (just "My trip to Paris"), return empty places array but still extract destination.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Remove markdown code blocks if present
      let cleanText = text.trim();
      
      // Sanitize more aggressively
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      logger.info(`Gemini extracted ${parsed.places?.length || 0} places from Instagram post`);
      logger.info(`Destination: ${parsed.destination || 'Unknown'} (${parsed.destination_country || 'Unknown'})`);

      return {
        summary: parsed.summary || 'No summary available',
        destination: parsed.destination,
        destination_country: parsed.destination_country,
        places: parsed.places || [],
      };
    } catch (error: any) {
      logger.error('Gemini Instagram analysis error:', error);
      // Fallback: return empty structure rather than crashing whole pipeline if analysis fails
      return {
        summary: caption.substring(0, 100) + '...',
        places: []
      };
    }
  }
}
