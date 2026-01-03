import { GoogleGenerativeAI, Content, SchemaType } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { config } from '../config/env';
import { ItemCategory, AgentContext, DiscoveryIntent } from '../types';
import logger from '../config/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { VideoDownloader } from '../utils/videoDownloader';
import { GEMINI_CONFIG, VIDEO_CONFIG } from '../config/constants';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const fileManager = new GoogleAIFileManager(config.gemini.apiKey);

// Model tiers for different use cases
export const MODELS = {
  FLASH: 'gemini-2.5-flash',  // Fast, cheap - for chat, intent detection (stable GA)
  PRO: 'gemini-2.5-pro',      // Complex reasoning - for planning, guides (stable GA)
  FLASH_LEGACY: 'gemini-2.0-flash',  // Fallback
};

// JSON Schemas for guaranteed extraction structure
export const extractionSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    destination: { type: SchemaType.STRING, nullable: true },
    destination_country: { type: SchemaType.STRING, nullable: true },
    video_type: { type: SchemaType.STRING, enum: ['places', 'howto', 'guide'], nullable: true },
    duration_days: { type: SchemaType.INTEGER, nullable: true },
    places: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING, enum: ['food', 'accommodation', 'place', 'shopping', 'activity', 'tip'] },
          description: { 
            type: SchemaType.STRING,
            description: 'Crisp Markdown summary. Use "•" for bullets. NO HTML TAGS. Use Title Case for sub-headings. Max 1000 chars.'
          },
          location: { type: SchemaType.STRING, nullable: true },
          cuisine_type: { type: SchemaType.STRING, nullable: true },
          place_type: { type: SchemaType.STRING, nullable: true },
          tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true }
        },
        required: ['name', 'category', 'description']
      }
    },
    itinerary: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          day: { type: SchemaType.INTEGER },
          title: { type: SchemaType.STRING },
          places: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
        }
      },
      nullable: true
    },
    discovery_intent: {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING },
        item: { type: SchemaType.STRING },
        city: { type: SchemaType.STRING },
        vibe: { type: SchemaType.STRING, nullable: true }
      },
      nullable: true
    }
  },
  required: ['summary', 'places']
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
          temperature: GEMINI_CONFIG.CHAT.TEMPERATURE,
          maxOutputTokens: GEMINI_CONFIG.CHAT.MAX_TOKENS,
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
          temperature: GEMINI_CONFIG.EXTRACTION.TEMPERATURE, // Low temp for consistent parsing
          responseMimeType: 'application/json',
          responseSchema: intentSchema as any, // THE MAGIC - Schema enforcement
        }
      });

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
      tags?: string[];
      cuisine_type?: string;
      place_type?: string;
      rating?: number;
      creator_insights?: string;
    }>
  ): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({ 
        model: MODELS.FLASH,
        generationConfig: {
          temperature: GEMINI_CONFIG.CHAT.TEMPERATURE,
          maxOutputTokens: GEMINI_CONFIG.CHAT.MAX_TOKENS,
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

      logger.info(`[GeminiResponse] Generating response for query in ${locationContext}`);

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

Generate a SHORT, friendly response:`;

      const result = await model.generateContent(prompt);
      return result.response.text() || "I found some interesting places for you! 🎯";
    } catch (error) {
      logger.error('Gemini places response error:', error);
      if (places.length === 0) {
        return "Hmm, I couldn't find anything matching that in your saved places. Want to save some more content? 🔍";
      }
      return `Found ${places.length} place(s) that might interest you! Check them out below 👇`;
    }
  }

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
  // CONTENT EXTRACTION METHODS (Updated with Hierarchy Rules)
  // ============================================

  /**
   * Fallback: Analyze video from title and description
   * Updated with HIERARCHY DETECTION (Parent/Child Locations)
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
      parent_location?: string; // NEW field for hierarchy
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
      const model = genAI.getGenerativeModel({ 
        model: MODELS.FLASH,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: extractionSchema as any,
          temperature: GEMINI_CONFIG.EXTRACTION.TEMPERATURE,
        }
      });

      const contentToAnalyze = transcript && transcript.length > 0 
        ? `Transcript:\n${transcript}`
        : `Description:\n${description}`;

      const prompt = `Analyze this YouTube travel video and extract only the MAJOR geographical locations (Hero Places) visited.

RULES FOR EXTRACTION:
1. Identify the "HERO" locations: These are the main destinations the creator actually spent time at.
2. ONE PIN PER COMPLEX: If the video shows multiple spots inside a single complex (e.g., "Giraffe Terrace" or "Blossom Restaurant" inside "Safari World"), do NOT create separate entries for them. 
3. RICH & CRISP DESCRIPTIONS: Instead, create ONE entry for the Parent Place (e.g., "Safari World Bangkok") and put all the specific spots, food items, and tips into the "description" field.
4. FORMATTING RULE: 
   - NEVER use HTML tags (<ul>, <li>, <b>, etc.).
   - Use clean Markdown-style bullet points (•).
   - Use Title Case for sub-sections followed by a colon (e.g., "Highlights:", "Food to Try:").
   - Add a newline between sections to keep it readable.
   - Be descriptive but concise.
5. IGNORE TRANSIT POINTS: Do not extract pickup points, meeting spots, or airports unless they are an actual destination visited.
6. INTENT DETECTION: If no specific businesses are named, but the video is clearly about a specific food/activity, return "discovery_intent".

Title: ${title}

${contentToAnalyze}`;

      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());

      return {
        video_type: parsed.video_type || 'places',
        summary: parsed.summary || 'No summary available',
        places: parsed.places || [],
        discovery_intent: parsed.discovery_intent,
        itinerary: parsed.itinerary,
        destination: parsed.destination,
        destination_country: parsed.destination_country,
        duration_days: parsed.duration_days,
      };
    } catch (error: any) {
      logger.error('Gemini metadata analysis error:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw new Error(`Failed to analyze metadata: ${error.message}`);
    }
  }

  /**
   * Analyze Reddit post and extract multiple places
   * Updated with HIERARCHY DETECTION
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
      parent_location?: string; // NEW
      cuisine_type?: string;
      place_type?: string;
      tags?: string[];
    }>;
  }> {
    try {
      const model = genAI.getGenerativeModel({ 
        model: MODELS.FLASH,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: extractionSchema as any,
          temperature: GEMINI_CONFIG.EXTRACTION.TEMPERATURE,
        }
      });

      const commentsText = comments.map((c, i) => `Comment ${i + 1}: ${c}`).join('\n\n');

      const prompt = `Analyze this Reddit discussion and extract only the MAJOR geographical locations (Hero Places) visited or discussed.

RULES FOR EXTRACTION:
1. Identify the "HERO" locations: These are the main destinations or complexes discussed.
2. ONE PIN PER COMPLEX: If multiple spots inside a single complex are mentioned (e.g. various restaurants inside "Terminal 21" mall), do NOT create separate entries. Create ONE entry for the Parent Place and list sub-spots in the description.
3. RICH & CRISP DESCRIPTIONS: Put all specific recommendations, food items, and tips into the "description" field.
4. FORMATTING RULE: 
   - NEVER use HTML tags. 
   - Use clean bullets (•).
   - Use Title Case for sections. 
   - Use double newlines to separate paragraphs or major blocks.

Title: ${title}
Body: ${body}
Comments: ${commentsText}

RESPOND ONLY WITH VALID JSON matching the provided schema.`;

      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());

      return {
        summary: parsed.summary || 'No summary available',
        destination: parsed.destination,
        destination_country: parsed.destination_country,
        places: parsed.places || [],
      };
    } catch (error: any) {
      logger.error('Gemini Reddit analysis error:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw new Error(`Failed to analyze Reddit post: ${error.message}`);
    }
  }

  /**
   * Analyze Instagram post (caption + image)
   * Updated with HIERARCHY DETECTION
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
      parent_location?: string; // NEW
      cuisine_type?: string;
      place_type?: string;
      tags?: string[];
    }>;
  }> {
    try {
      const model = genAI.getGenerativeModel({ 
        model: MODELS.FLASH,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: extractionSchema as any,
          temperature: GEMINI_CONFIG.EXTRACTION.TEMPERATURE,
        }
      });

      const prompt = `Analyze this Instagram travel post (caption) and extract only the MAJOR geographical locations (Hero Places) visited.

RULES FOR EXTRACTION:
1. Identify the "HERO" locations: These are the main destinations or complexes visited.
2. ONE PIN PER COMPLEX: If multiple spots inside a single complex are mentioned (e.g. various restaurants inside a mall), do NOT create separate entries. Create ONE entry for the Parent Place.
3. RICH & CRISP DESCRIPTIONS: Put all specific recommendations, food items, and tips into the "description" field.
4. FORMATTING RULE: 
   - NEVER use HTML tags. 
   - Use clean bullets (•).
   - Use Title Case for sections. 
   - Use double newlines to separate paragraphs or major blocks.

Caption: ${caption}
Image URL: ${imageUrl || 'Not available'}

RESPOND ONLY WITH VALID JSON matching the provided schema.`;

      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());

      return {
        summary: parsed.summary || 'No summary available',
        destination: parsed.destination,
        destination_country: parsed.destination_country,
        places: parsed.places || [],
      };
    } catch (error: any) {
      logger.error('Gemini Instagram analysis error:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      return { summary: caption.substring(0, 100) + '...', places: [] };
    }
  }

  /**
   * Analyze video content directly using Gemini's vision capabilities
   * UPDATED: Cloud-Native Strategy (Direct URL for YouTube, Proxy for others)
   */
  static async analyzeVideoContent(
    videoUrl: string,
    options: {
      platform: 'youtube' | 'instagram' | 'tiktok';
      caption?: string;
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
      parent_location?: string;
      cuisine_type?: string;
      place_type?: string;
      tags?: string[];
    }>;
    discovery_intent?: DiscoveryIntent;
  }> {
    const contextInfo = options.caption ? `\n\nAdditional context: "${options.caption}"` : '';
    const titleInfo = options.title ? `\nVideo title: "${options.title}"` : '';
    
    const prompt = `Analyze this ${options.platform} travel video and extract only the MAJOR geographical locations (Hero Places) visited.

RULES FOR EXTRACTION:
1. Identify the "HERO" locations: These are the main destinations or complexes visited.
2. ONE PIN PER COMPLEX: If multiple spots inside a single complex are shown (e.g. various restaurants inside a mall), do NOT create separate entries. Create ONE entry for the Parent Place.
3. RICH & CRISP DESCRIPTIONS: Put all specific recommendations, food items, and tips into the "description" field.
4. FORMATTING RULE: 
   - NEVER use HTML tags. 
   - Use clean bullets (•).
   - Use Title Case for sections. 
   - Use double newlines to separate paragraphs or major blocks.
5. **IMPORTANT: Read ALL on-screen text carefully!** Look for restaurant names, shop names, signs, logos, and storefront text.

${titleInfo}${contextInfo}

RESPOND WITH VALID JSON matching the provided schema.`;

    // 1. YOUTUBE OPTION: Direct URL (No download, zero bandwidth/disk impact)
    if (options.platform === 'youtube') {
      try {
        logger.info(`[Gemini Video] Using Direct YouTube URL analysis: ${videoUrl}`);
        
        const model = genAI.getGenerativeModel({ 
          model: MODELS.FLASH, // Use stable model
          generationConfig: { 
            responseMimeType: 'application/json',
            responseSchema: extractionSchema as any,
          }
        });

        const result = await model.generateContent([
          { 
            fileData: { 
              mimeType: 'video/youtube', 
              fileUri: videoUrl 
            } 
          },
          { text: prompt },
        ]);
        
        const parsed = JSON.parse(result.response.text());
        
        return {
          summary: parsed.summary || '',
          video_type: parsed.video_type || 'places',
          destination: parsed.destination,
          destination_country: parsed.destination_country,
          places: parsed.places || [],
          discovery_intent: parsed.discovery_intent,
        };
      } catch (error: any) {
        logger.error(`[Gemini Video] YouTube Direct analysis failed: ${error.message}`);
        throw error;
      }
    }

    // 2. INSTAGRAM/TIKTOK OPTION: Download via Proxy (IPRoyal)
    let tempFilePath: string | null = null;
    
    try {
      // Use unified VideoDownloader
      tempFilePath = await VideoDownloader.download(videoUrl, options.platform);
      
      // Before upload
      const stats = fs.statSync(tempFilePath);
      const maxSize = VIDEO_CONFIG.MAX_SIZE_MB * 1024 * 1024;

      if (stats.size > maxSize) {
        throw new Error(
          `Video too large for Gemini: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max ${VIDEO_CONFIG.MAX_SIZE_MB}MB)`
        );
      }

      logger.info(`[Gemini Video] Uploading ${(stats.size / 1024 / 1024).toFixed(2)}MB file`);

      const uploadResult = await fileManager.uploadFile(tempFilePath, {
        mimeType: 'video/mp4',
        displayName: `${options.platform}_${crypto.randomUUID()}`,
      });
      
      let file = uploadResult.file;
      while (file.state === 'PROCESSING') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        file = await fileManager.getFile(file.name);
      }
      
      if (file.state === 'FAILED') throw new Error('Video processing failed');
      
      const model = genAI.getGenerativeModel({ 
        model: MODELS.FLASH,
        generationConfig: { 
          responseMimeType: 'application/json',
          responseSchema: extractionSchema as any,
        }
      });
      
      const result = await model.generateContent([
        { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
        { text: prompt },
      ]);
      
      const parsed = JSON.parse(result.response.text());
      
      await fileManager.deleteFile(file.name);
      
      return {
        summary: parsed.summary || '',
        video_type: parsed.video_type || 'places',
        destination: parsed.destination,
        destination_country: parsed.destination_country,
        places: parsed.places || [],
        discovery_intent: parsed.discovery_intent,
      };
      
    } catch (error: any) {
      const errorMsg = error.message || error.toString();
      logger.error(`[Gemini Video] Analysis error:`, {
        message: errorMsg,
        stack: error.stack,
        cause: error.cause,
      });
      throw new Error(`Video analysis failed: ${errorMsg}`);
    } finally {
      VideoDownloader.cleanup(tempFilePath);
    }
  }

  // Legacy method preserved but deprecated
  /**
   * @deprecated Use analyzeVideoMetadata() instead
   */
  static async analyzeYouTubeVideo(videoUrl: string): Promise<any> {
    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });

      const prompt = `Analyze this YouTube video: ${videoUrl}
Please provide a brief summary and extract specific places.
Respond ONLY with valid JSON.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Failed to parse Gemini response');
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || 'No summary available',
        places: parsed.places || [],
      };
    } catch (error: any) {
      logger.error('Gemini YouTube analysis error:', error);
      return { summary: 'Error', places: [] };
    }
  }
}
