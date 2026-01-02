import { GoogleGenerativeAI, Content, SchemaType } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { config } from '../config/env';
import { ItemCategory, AgentContext, DiscoveryIntent } from '../types';
import logger from '../config/logger';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const fileManager = new GoogleAIFileManager(config.gemini.apiKey);

// Model tiers for different use cases
const MODELS = {
  FLASH: 'gemini-2.5-flash',  // Fast, cheap - for chat, intent detection (stable GA)
  PRO: 'gemini-2.5-pro',      // Complex reasoning - for planning, guides (stable GA)
  FLASH_LEGACY: 'gemini-2.0-flash',  // Fallback
};

export class GeminiService {
  // ============================================
  // CHAT & AGENT METHODS (NEW - Gemini 2.5)
  // ============================================

  /**
   * Generate system prompt for the travel agent
   * UPDATED: Amnesic Agent - ONLY uses extracted context, zero external knowledge
   */
  private static getTravelAgentSystemPrompt(context: AgentContext): string {
    return `You are TravelPal, an excited travel co-pilot helping ${context.userName} with their notes for ${context.destination}.

**CRITICAL PHILOSOPHY:**
1. You are AMNESIC. You have zero general knowledge about the world, restaurants, or travel destinations.
2. You ONLY know what is in the "SAVED PLACES" context provided to you.
3. If a user asks "Why is this place famous?" and the description doesn't say why, you MUST say "My notes from the creator didn't mention why, but I have it saved for you!"
4. NEVER use your internal training data to answer questions. ONLY use the provided descriptions and creator insights.
5. You are a co-pilot/guide for the user's EXISTING notes. You are not a travel planner or search engine.

Key responsibilities:
1. Summarize what the user has ALREADY saved.
2. Answer questions strictly using the extracted metadata (descriptions, tags, creator insights).
3. Help the user navigate their visual map by suggesting their own saved spots.

Tone guidelines:
- Enthusiastic but strictly evidence-based.
- Keep responses concise (1-3 sentences).
- If information is missing from the notes, be honest and say it wasn't in the original video/link.`;
  }

  /**
   * Chat with the travel agent using Gemini 2.5 Flash
   * Fast, cheap, great for conversational interactions
   */
  static async chat(
    context: AgentContext,
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({ 
        model: MODELS.FLASH,
        systemInstruction: this.getTravelAgentSystemPrompt(context),
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 500,
        }
      });

      // Convert history to Gemini format
      const history: Content[] = conversationHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userMessage);
      
      return result.response.text() || 'Sorry, I had trouble responding. 😅';
    } catch (error: any) {
      logger.error('Gemini chat error:', error);
      // Fallback to legacy model
      try {
        logger.info('Falling back to gemini-2.0-flash for chat');
        const fallbackModel = genAI.getGenerativeModel({ 
          model: MODELS.FLASH_LEGACY,
          generationConfig: { temperature: 0.8, maxOutputTokens: 500 }
        });
        const result = await fallbackModel.generateContent(
          `${this.getTravelAgentSystemPrompt(context)}\n\nUser: ${userMessage}`
        );
        return result.response.text() || 'Sorry, I had trouble responding. 😅';
      } catch (fallbackError) {
        logger.error('Gemini fallback chat error:', fallbackError);
        throw new Error('Failed to generate response');
      }
    }
  }

  /**
   * Analyze user query intent using Gemini 2.5 Flash
   * Returns structured intent for routing
   */
  /**
   * Analyze user query intent using Schema-Enforced JSON ("Don't Beg" approach)
   * Uses responseSchema for GUARANTEED structure - no parsing errors, no hallucinated fields
   */
  static async analyzeIntent(
    query: string,
    context: { 
      hasLocation: boolean; 
      currentTime: string;
      destination: string;
    }
  ): Promise<{
    type: 'location_based' | 'category' | 'specific' | 'surprise' | 'general' | 'alternatives' | 'planning';
    category?: ItemCategory;
    keywords: string[];
    distance?: 'nearby' | 'walking' | 'any';
    time?: 'now' | 'later' | 'any';
    referencedPlace?: string;
    reason?: string;
    // Smart query fields
    limit?: number;
    sortBy?: 'rating' | 'distance' | 'recent' | 'review_count' | null;
    sortOrder?: 'desc' | 'asc';
    cuisineType?: string;
    specificDish?: string;
  }> {
    try {
      // SCHEMA DEFINITION - Forces model to strictly follow this structure
      // This is the "Don't Beg" solution - guaranteed JSON, no parsing errors
      const intentSchema: {
        type: typeof SchemaType.OBJECT;
        properties: Record<string, any>;
        required: string[];
      } = {
        type: SchemaType.OBJECT,
        properties: {
          type: { 
            type: SchemaType.STRING, 
            enum: ['location_based', 'category', 'specific', 'surprise', 'general', 'alternatives', 'planning'],
            description: 'The primary intent type'
          },
          category: { 
            type: SchemaType.STRING, 
            enum: ['food', 'shopping', 'place', 'activity', 'accommodation', 'tip'],
            nullable: true,
            description: 'Content category if mentioned'
          },
          keywords: { 
            type: SchemaType.ARRAY, 
            items: { type: SchemaType.STRING },
            description: 'Relevant search keywords'
          },
          distance: { 
            type: SchemaType.STRING, 
            enum: ['nearby', 'walking', 'any'],
            nullable: true 
          },
          time: { 
            type: SchemaType.STRING, 
            enum: ['now', 'later', 'any'],
            nullable: true 
          },
          // Smart query fields - INTEGER guarantees real numbers
          limit: { 
            type: SchemaType.INTEGER, 
            nullable: true,
            description: 'Number of results requested (e.g., "top 3" = 3)'
          },
          sortBy: { 
            type: SchemaType.STRING, 
            enum: ['rating', 'distance', 'recent', 'review_count'],
            nullable: true,
            description: 'How to sort results'
          },
          sortOrder: { 
            type: SchemaType.STRING, 
            enum: ['desc', 'asc'],
            nullable: true 
          },
          cuisineType: { 
            type: SchemaType.STRING, 
            nullable: true,
            description: 'Specific cuisine (ramen, pizza, coffee, etc.)'
          },
          specificDish: { 
            type: SchemaType.STRING, 
            nullable: true,
            description: 'Specific dish name if mentioned'
          },
          referencedPlace: { 
            type: SchemaType.STRING, 
            nullable: true,
            description: 'Place name for alternatives intent'
          },
          reason: { 
            type: SchemaType.STRING, 
            nullable: true,
            description: 'Reason for alternatives (closed, crowded, etc.)'
          },
        },
        required: ['type', 'keywords']
      };

      const model = genAI.getGenerativeModel({ 
        model: MODELS.FLASH,
        generationConfig: {
          temperature: 0.1, // Low temp for consistent parsing
          responseMimeType: 'application/json',
          responseSchema: intentSchema, // THE MAGIC - Schema enforcement
        }
      });

      // Simplified prompt - schema handles structure, we just need intent guidance
      const prompt = `Parse this travel query. Context: Time ${context.currentTime}, Location ${context.hasLocation ? 'Known' : 'Unknown'}, Destination: ${context.destination}.

User query: "${query}"

PARSING RULES:
- "near me", "nearby", "closest" → type: location_based, sortBy: distance, sortOrder: asc
- "best rated", "top rated", "highest rated" → sortBy: rating, sortOrder: desc
- "most popular", "viral", "famous" → sortBy: review_count, sortOrder: desc
- "top 3", "best 5", "give me 2" → limit: that number
- "a few" → limit: 3
- Food types like "ramen", "pizza", "coffee" → cuisineType: that type
- "X is closed", "alternative to X" → type: alternatives, referencedPlace: X
- "surprise me", "random" → type: surprise
- "plan my day" → type: planning

Extract the structured intent from the query.`;

      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());
      
      logger.info(`[SmartIntent] Schema-enforced: type=${parsed.type}, limit=${parsed.limit}, sortBy=${parsed.sortBy}, cuisineType=${parsed.cuisineType}`);
      
      // Return with defaults for optional fields
      return {
        type: parsed.type || 'general',
        category: parsed.category || undefined,
        keywords: parsed.keywords || [],
        distance: parsed.distance || 'any',
        time: parsed.time || 'any',
        referencedPlace: parsed.referencedPlace || undefined,
        reason: parsed.reason || undefined,
        limit: parsed.limit || undefined,
        sortBy: parsed.sortBy || undefined,
        sortOrder: parsed.sortOrder || 'desc',
        cuisineType: parsed.cuisineType || undefined,
        specificDish: parsed.specificDish || undefined,
      };
    } catch (error) {
      logger.error('Gemini intent analysis error:', error);
      return {
        type: 'general',
        keywords: [],
        distance: 'any',
        time: 'any',
      };
    }
  }

  /**
   * Generate natural language response about saved places
   * Uses Gemini 2.5 Flash for fast, conversational responses
   */
  static async generatePlacesResponse(
    query: string,
    context: {
      userName: string;
      destination: string;
      currentTime: string;
      // NEW: Smart query context
      limit?: number;
      sortBy?: string;
      cuisineType?: string;
    },
    places: Array<{
      name: string;
      category: string;
      description?: string;
      location_name?: string;
      distance?: number;
      source_title?: string;
      // NEW: Creator insights from video/post extraction
      tags?: string[];
      cuisine_type?: string;
      place_type?: string;
      rating?: number;
      creator_insights?: string; // Extracted from transcript/caption
    }>
  ): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({ 
        model: MODELS.FLASH,
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 500, // Increased for richer responses
        }
      });

      // SMART: Extract actual locations from the places found
      const uniqueLocations = [...new Set(places
        .map(p => p.location_name)
        .filter(Boolean)
      )];
      const locationContext = uniqueLocations.length > 0 
        ? uniqueLocations.slice(0, 3).join(', ') 
        : context.destination;

      const placesContext = places.map((p, i) => {
        let placeInfo = `
${i + 1}. ${p.name} - ${p.category}${p.cuisine_type ? ` (${p.cuisine_type})` : ''}${p.place_type ? ` (${p.place_type})` : ''}
   Location: ${p.location_name || 'Unknown'}`;
        
        if (p.distance) {
          placeInfo += `\n   Distance: ${p.distance < 1000 ? `${Math.round(p.distance)}m` : `${(p.distance / 1000).toFixed(1)}km`}`;
        }
        if (p.rating) {
          placeInfo += `\n   Rating: ⭐ ${p.rating}`;
        }
        if (p.description) {
          placeInfo += `\n   Why it's special: ${p.description}`;
        }
        if (p.tags && p.tags.length > 0) {
          placeInfo += `\n   Tags: ${p.tags.join(', ')}`;
        }
        if (p.creator_insights) {
          placeInfo += `\n   Creator said: "${p.creator_insights}"`;
        }
        placeInfo += `\n   Saved from: ${p.source_title || 'User saved'}`;
        
        return placeInfo;
      }).join('\n');

      // Build smart context for the prompt
      let queryContext = '';
      if (context.sortBy === 'rating') {
        queryContext = `The user asked for BEST RATED places. These are sorted by rating (highest first).`;
      } else if (context.sortBy === 'distance') {
        queryContext = `The user asked for CLOSEST places. These are sorted by distance.`;
      }
      if (context.limit) {
        queryContext += ` They specifically asked for ${context.limit} results.`;
      }
      if (context.cuisineType) {
        queryContext += ` They're looking for ${context.cuisineType}.`;
      }

      const prompt = `You are TravelPal, a contextual co-pilot helping ${context.userName}.

User asked: "${query}"
Time: ${context.currentTime}
Trip destination: ${context.destination}

${queryContext}

THEIR SAVED PLACES (${places.length} found):
${placesContext || 'No saved places match this query'}

**AMNESIC CO-PILOT RULES:**
1. ONLY use the info in the "SAVED PLACES" list above. 
2. If the user asks for details (like "why is it famous?") that aren't in the "Why it's special" or "Creator said" fields, DO NOT use your own knowledge. Say you don't have that info in your notes.
3. DO NOT LIST THE PLACES in your message - they will be shown as interactive swipeable cards below your message.
4. Keep your response EXTREMELY SHORT (1-2 sentences).
5. Just acknowledge the request and tell them to swipe through the cards.

**GOOD EXAMPLES:**
- "I found ${places.length} spots in ${locationContext} that match your request! Swipe through to see what you saved 📍"
- "Found these ramen spots in your notes! The creator didn't say much about them, but here they are."

Generate a SHORT, friendly response:`;

      const result = await model.generateContent(prompt);
      return result.response.text() || "I found some interesting places for you! 🎯";
    } catch (error) {
      logger.error('Gemini places response error:', error);
      
      // Fallback response
      if (places.length === 0) {
        return "Hmm, I couldn't find anything matching that in your saved places. Want to save some more content? 🔍";
      }
      return `Found ${places.length} place(s) that might interest you! Check them out below 👇`;
    }
  }

  /**
   * Complex reasoning tasks using Gemini 2.5 Pro
   * Used for: Day planning, guide parsing, itinerary optimization
   */
  static async complexReasoning(
    prompt: string,
    options: {
      jsonMode?: boolean;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({ 
        model: MODELS.PRO,
        generationConfig: {
          responseMimeType: options.jsonMode ? 'application/json' : 'text/plain',
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: options.maxTokens ?? 2000,
        }
      });

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: any) {
      logger.error('Gemini Pro reasoning error:', error);
      // Fallback to Flash for complex tasks
      logger.info('Falling back to Flash for complex reasoning');
      const fallbackModel = genAI.getGenerativeModel({ 
        model: MODELS.FLASH,
        generationConfig: {
          responseMimeType: options.jsonMode ? 'application/json' : 'text/plain',
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: options.maxTokens ?? 2000,
        }
      });
      const result = await fallbackModel.generateContent(prompt);
      return result.response.text();
    }
  }

  // ============================================
  // CONTENT EXTRACTION METHODS (Existing)
  // ============================================
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
        model: 'gemini-2.0-flash',
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
    destination?: string;
    destination_country?: string;
    duration_days?: number;
    places: Array<{
      name: string;
      category: ItemCategory;
      description: string;
      location?: string;
      day?: number;
      cuisine_type?: string;
      place_type?: string;
      tags?: string[];
    }>;
    discovery_intent?: DiscoveryIntent;
    itinerary?: Array<{
      day: number;
      title: string;
      places: string[];
    }>;
  }> {
    try {
      // Use gemini-2.0-flash (GA) with structured output for guaranteed JSON
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });

      // Use transcript if available, otherwise fall back to description
      // Note: gemini-2.0-flash has 1M token context, so we can use full transcript
      const contentToAnalyze = transcript && transcript.length > 0 
        ? `Transcript:\n${transcript}`
        : `Description:\n${description}`;

      const prompt = `Analyze this YouTube travel video and determine its type, then extract relevant information.

Title: ${title}

${contentToAnalyze}

STEP 1 - CLASSIFY VIDEO TYPE:
Determine if this is a:
- **GUIDE/ITINERARY VIDEO**: Provides a day-by-day travel itinerary or trip plan
- **PLACES VIDEO**: Recommends specific restaurants, shops, attractions without a day-by-day structure
- **HOW-TO VIDEO**: Teaches tips, etiquette, or advice without recommending specific places

STEP 2 - EXTRACT DESTINATION:
ALWAYS extract the destination country and city/region.

STEP 3 - EXTRACT PLACES OR INTENT:

**CRITICAL RULES FOR PLACE EXTRACTION:**
1. Extract the OFFICIAL BUSINESS/RESTAURANT NAME, NOT the dish name.
2. If no specific businesses are named, but the video is clearly about a specific food/activity in a city (e.g. "Finding the best cheesecake in NYC"), you MUST return a "discovery_intent" object instead of empty places.

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
      "description": "...",
      "location": "...",
      "day": 1,
      "cuisine_type": "ramen",
      "tags": ["michelin", "budget"]
    }
  ],
  "discovery_intent": {
    "type": "DISH_GOAL" or "CULINARY_GOAL" or "ACTIVITY_GOAL" or "SIGHTSEEING_GOAL",
    "item": "The specific food or activity mentioned (e.g., Pad Thai, Cheesecake, Street Tacos, Surfing)",
    "city": "The city or area targeted",
    "vibe": "The style (e.g., legendary, traditional, viral, hidden)",
    "scout_query": "Best [item] specialists in [city]",
    "confidence_score": 0.0 to 1.0,
    "grounded_suggestions": [
      {
        "name": "Famous Restaurant Name",
        "street_hint": "Neighborhood or street (e.g., SoHo, 45th Street)",
        "why_famous": "Brief reason why this is legendary for this dish"
      }
    ]
  }
}

**GROUNDING LITE RULE (IMPORTANT):**
If NO specific restaurant names are mentioned, but the video is clearly about a specific DISH in a CITY:
1. Return a "discovery_intent" object with type="DISH_GOAL"
2. In the "grounded_suggestions" array, suggest exactly 3 WORLD-FAMOUS or HIGHLY-RATED restaurants for that dish in that city FROM YOUR OWN KNOWLEDGE
3. These should be legendary, viral, or critically-acclaimed spots that are commonly featured in "Best of" lists
4. Include the street/neighborhood hint for geocoding

Example: Video about "Finding amazing cheesecake in NYC" with no specific restaurant names:
- discovery_intent.item = "Cheesecake"
- discovery_intent.city = "New York"  
- grounded_suggestions = [
    {"name": "Junior's Restaurant", "street_hint": "Flatbush Ave, Brooklyn", "why_famous": "Iconic NYC cheesecake since 1950"},
    {"name": "Eileen's Special Cheesecake", "street_hint": "Cleveland Place, SoHo", "why_famous": "Famous mini cheesecakes in NoLita"},
    {"name": "Veniero's Pasticceria", "street_hint": "East 11th Street", "why_famous": "Italian bakery with legendary cheesecake since 1894"}
  ]

If specific places ARE found, set "discovery_intent" to null.`;

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
        discovery_intent: parsed.discovery_intent,
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
        model: 'gemini-2.0-flash',
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
        model: 'gemini-2.0-flash',
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
    discovery_intent?: DiscoveryIntent;
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
  ],
  "discovery_intent": {
    "type": "CULINARY_GOAL" or "ACTIVITY_GOAL" or "SIGHTSEEING_GOAL",
    "item": "The specific food or activity mentioned (e.g., Cheesecake, Street Tacos, Surfing)",
    "city": "The city or area targeted",
    "vibe": "The style (e.g., legendary, traditional, viral, hidden)",
    "scout_query": "Best [vibe] [item] in [city]",
    "confidence_score": 0.0 to 1.0
  }
}

**GROUNDING LITE RULE (IMPORTANT):**
If NO specific restaurant names are identified, but the video is clearly about a specific DISH in a CITY:
1. Return a "discovery_intent" object with type="DISH_GOAL" (or CULINARY_GOAL for general food exploration)
2. In the "grounded_suggestions" array, suggest exactly 3 WORLD-FAMOUS restaurants for that dish in that city FROM YOUR OWN KNOWLEDGE
3. These should be legendary, viral, or critically-acclaimed spots commonly featured in "Best of" lists
4. Include the street/neighborhood hint for geocoding

Example JSON for discovery_intent when grounding:
{
  "discovery_intent": {
    "type": "DISH_GOAL",
    "item": "Cheesecake",
    "city": "New York",
    "vibe": "legendary",
    "scout_query": "Best legendary cheesecake in New York",
    "confidence_score": 0.9,
    "grounded_suggestions": [
      {"name": "Junior's Restaurant", "street_hint": "Flatbush Ave, Brooklyn", "why_famous": "Iconic NYC cheesecake since 1950"},
      {"name": "Eileen's Special Cheesecake", "street_hint": "Cleveland Place, SoHo", "why_famous": "Famous mini cheesecakes"},
      {"name": "Veniero's Pasticceria", "street_hint": "East 11th Street", "why_famous": "Italian bakery legend since 1894"}
    ]
  }
}

If specific places ARE found, set "discovery_intent" to null.`;

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
        discovery_intent: parsed.discovery_intent,
      };
      
    } catch (error: any) {
      // Log full error details for debugging
      const errorMsg = error.message || error.toString() || 'Unknown error';
      const errorCode = error.code || error.response?.status || 'NO_CODE';
      logger.error(`[Gemini Video] Analysis error: ${errorMsg} (code: ${errorCode})`);
      throw new Error(`Video analysis failed: ${errorMsg}`);
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