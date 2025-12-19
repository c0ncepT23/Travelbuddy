import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { config } from '../config/env';
import { ItemCategory } from '../types';
import logger from '../config/logger';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const fileManager = new GoogleAIFileManager(config.gemini.apiKey);

export class GeminiService {
  /**
   * @deprecated Use analyzeVideoMetadata() instead - it uses transcript from yt-dlp
   * This method passes URL directly to Gemini which cannot "watch" videos
   * Kept for backwards compatibility but not recommended
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
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-3-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });

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
      // Use gemini-3-flash (GA) with structured output for guaranteed JSON
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-3-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });

      // Use transcript if available, otherwise fall back to description
      // Note: gemini-3-flash has 1M token context, so we can use full transcript
      const contentToAnalyze = transcript && transcript.length > 0 
        ? `Transcript:\n${transcript}`
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

**CRITICAL RULES FOR PLACE EXTRACTION:**
1. Extract the OFFICIAL BUSINESS/RESTAURANT NAME, NOT the dish name
   - ✅ CORRECT: "Pad Thai Fai Ta Lu" (the restaurant)
   - ❌ WRONG: "Smoky Pad Thai" (the dish)
   - ✅ CORRECT: "Go Ang" (the restaurant)  
   - ❌ WRONG: "Hainanese Chicken" (the dish)
2. Each restaurant/place should appear ONLY ONCE, even if multiple dishes are mentioned
3. Use the exact name as spoken/shown in the video
4. If a place name is unclear, include context like "Go Ang Chicken Rice" or "Kor Panich Sticky Rice"

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
      "name": "Ichiran Ramen Shibuya",
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
    },
    {
      "name": "Pad Thai Fai Ta Lu",
      "category": "food",
      "description": "Michelin-recommended street food for smoky Pad Thai with grilled pork or prawns",
      "location": "Bangkok, Thailand",
      "cuisine_type": "street food",
      "tags": ["michelin", "budget-friendly", "street food"]
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
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-3-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });

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
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-3-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });

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

  /**
   * Analyze video content directly using Gemini's vision capabilities
   * Used for: Instagram Reels (always), YouTube (when no transcript)
   * Downloads video, uploads to Gemini File API, extracts places from visual content
   */
  static async analyzeVideoContent(
    videoUrl: string,
    options: {
      platform: 'youtube' | 'instagram' | 'tiktok';
      caption?: string; // Additional text context (Instagram caption, video title)
      title?: string;
    }
  ): Promise<{
    summary: string;
    video_type: 'places' | 'howto' | 'guide';
    destination?: string;
    destination_country?: string;
    places: Array<{
      name: string;
      category: string;
      description: string;
      location?: string;
      cuisine_type?: string;
      place_type?: string;
      tags?: string[];
    }>;
  }> {
    let tempFilePath: string | null = null;
    
    try {
      logger.info(`[Gemini Video] Starting video analysis for ${options.platform}: ${videoUrl}`);
      
      // Step 1: Download video to temp file
      logger.info('[Gemini Video] Downloading video...');
      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'arraybuffer',
        timeout: 120000, // 2 minute timeout for large videos
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      // Determine file extension from content-type or URL
      const contentType = response.headers['content-type'] || 'video/mp4';
      const ext = contentType.includes('mp4') ? '.mp4' : 
                  contentType.includes('webm') ? '.webm' : '.mp4';
      
      tempFilePath = path.join(os.tmpdir(), `yori_video_${Date.now()}${ext}`);
      fs.writeFileSync(tempFilePath, response.data);
      
      const fileSizeKB = Math.round(response.data.length / 1024);
      logger.info(`[Gemini Video] Downloaded ${fileSizeKB}KB to ${tempFilePath}`);
      
      // Step 2: Upload to Gemini File API
      logger.info('[Gemini Video] Uploading to Gemini...');
      const uploadResult = await fileManager.uploadFile(tempFilePath, {
        mimeType: contentType.split(';')[0], // Remove charset if present
        displayName: `video_${Date.now()}`,
      });
      
      logger.info(`[Gemini Video] Upload complete: ${uploadResult.file.name}`);
      
      // Step 3: Wait for processing (Gemini needs to process the video)
      let file = uploadResult.file;
      while (file.state === 'PROCESSING') {
        logger.info('[Gemini Video] Waiting for video processing...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        const getResult = await fileManager.getFile(file.name);
        file = getResult;
      }
      
      if (file.state === 'FAILED') {
        throw new Error('Video processing failed');
      }
      
      logger.info('[Gemini Video] Video ready for analysis');
      
      // Step 4: Analyze with Gemini
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp', // Use 2.0 for video (3.0 may not support yet)
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });
      
      const contextInfo = options.caption 
        ? `\n\nAdditional context from caption/title: "${options.caption}"` 
        : '';
      const titleInfo = options.title ? `\nVideo title: "${options.title}"` : '';
      
      const prompt = `Analyze this ${options.platform} travel video and extract ALL places mentioned or shown.

${titleInfo}${contextInfo}

**IMPORTANT: Read ALL on-screen text carefully!**
- Look for restaurant names, shop names, place names shown as text overlays
- Look for addresses or location indicators
- Look for price tags, menu items with restaurant context
- Look for signs, logos, storefront text

**CRITICAL RULES FOR PLACE EXTRACTION:**
1. Extract the OFFICIAL BUSINESS/RESTAURANT NAME, NOT dish descriptions
   - ✅ CORRECT: "Pad Thai Fai Ta Lu" (the restaurant)
   - ❌ WRONG: "Smoky Pad Thai" (the dish)
2. Each place should appear ONLY ONCE
3. Use the exact name as shown/spoken in the video

For FOOD places, identify cuisine_type: "ramen", "street food", "cafe", "fine dining", etc.
For OTHER places, identify place_type: "temple", "market", "viewpoint", "shopping mall", etc.

RESPOND WITH VALID JSON:
{
  "summary": "Brief description of what this video shows",
  "video_type": "places" or "guide" or "howto",
  "destination": "City name (e.g., Bangkok, Tokyo)",
  "destination_country": "Country name (e.g., Thailand, Japan)",
  "places": [
    {
      "name": "Exact business/place name",
      "category": "food" or "place" or "shopping" or "activity",
      "description": "What makes this place special",
      "location": "Area/neighborhood if mentioned",
      "cuisine_type": "For food places",
      "place_type": "For non-food places",
      "tags": ["michelin", "budget-friendly", "hidden gem", etc.]
    }
  ]
}

If no specific places are identifiable, return empty places array.`;

      const result = await model.generateContent([
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        },
        { text: prompt },
      ]);
      
      const text = result.response.text();
      logger.info(`[Gemini Video] Raw response: ${text.substring(0, 200)}...`);
      
      // Parse JSON response
      let cleanText = text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      const parsed = JSON.parse(cleanText);
      
      logger.info(`[Gemini Video] Extracted ${parsed.places?.length || 0} places from video`);
      if (parsed.destination) {
        logger.info(`[Gemini Video] Destination: ${parsed.destination} (${parsed.destination_country})`);
      }
      
      // Step 5: Cleanup - delete uploaded file from Gemini
      try {
        await fileManager.deleteFile(file.name);
        logger.info('[Gemini Video] Cleaned up uploaded file');
      } catch (cleanupError) {
        logger.warn('[Gemini Video] Failed to cleanup uploaded file:', cleanupError);
      }
      
      return {
        summary: parsed.summary || '',
        video_type: parsed.video_type || 'places',
        destination: parsed.destination,
        destination_country: parsed.destination_country,
        places: parsed.places || [],
      };
      
    } catch (error: any) {
      logger.error('[Gemini Video] Analysis error:', error.message);
      throw error;
    } finally {
      // Always cleanup temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          logger.info('[Gemini Video] Cleaned up temp file');
        } catch (e) {
          logger.warn('[Gemini Video] Failed to cleanup temp file');
        }
      }
    }
  }
}