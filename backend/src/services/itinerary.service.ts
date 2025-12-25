import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import { TripSegmentModel } from '../models/tripSegment.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { TripSegment } from '../types';
import logger from '../config/logger';

// Migrated from OpenAI to Gemini 2.5 Flash (100x cheaper, faster)
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';

interface ParsedItineraryInfo {
  city?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  accommodation?: string;
  isComplete: boolean;
  missingFields: string[];
}

interface ItineraryCollectionState {
  stage: 'initial' | 'collecting_city' | 'collecting_dates' | 'collecting_hotel' | 'confirming' | 'complete';
  pendingSegment?: Partial<ParsedItineraryInfo>;
  segments: TripSegment[];
}

export class ItineraryService {
  /**
   * Parse natural language input to extract itinerary information
   */
  static async parseItineraryInput(
    input: string,
    tripDestination: string,
    existingSegments: TripSegment[]
  ): Promise<ParsedItineraryInfo> {
    try {
      const existingCities = existingSegments.map(s => s.city).join(', ');
      
      const prompt = `Extract travel itinerary information from the user's message.

Trip destination: ${tripDestination}
Already added cities: ${existingCities || 'None'}

User message: "${input}"

Extract:
1. City/location name (if mentioned)
2. Country (if mentioned or inferrable)
3. Start date (parse relative dates like "Dec 6", "next Monday", "6th to 10th")
4. End date
5. Accommodation/hotel name (if mentioned)

For dates:
- Use ISO format YYYY-MM-DD
- Assume current year unless specified
- "Dec 6-10" means Dec 6 to Dec 10
- "next week" should be calculated from today

Respond with JSON only:
{
  "city": "city name or null",
  "country": "country or null",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "accommodation": "hotel name or null",
  "isComplete": true if city AND dates are provided,
  "missingFields": ["list", "of", "missing", "required", "fields"]
}`;

      const model = genAI.getGenerativeModel({ 
        model: GEMINI_MODEL,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        }
      });

      const response = await model.generateContent(prompt);
      const text = response.response.text();
      
      // Clean up JSON if wrapped in markdown
      let cleanText = text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      const result = JSON.parse(cleanText);
      
      logger.info(`[Itinerary] Parsed input: ${JSON.stringify(result)}`);
      
      return {
        city: result.city,
        country: result.country,
        startDate: result.startDate,
        endDate: result.endDate,
        accommodation: result.accommodation,
        isComplete: result.isComplete || false,
        missingFields: result.missingFields || [],
      };
    } catch (error) {
      logger.error('[Itinerary] Parse error:', error);
      return {
        isComplete: false,
        missingFields: ['city', 'dates'],
      };
    }
  }

  /**
   * Generate conversational response for itinerary collection
   */
  static async generateItineraryResponse(
    tripId: string,
    userId: string,
    userMessage: string,
    currentState?: ItineraryCollectionState
  ): Promise<{
    message: string;
    action?: 'created_segment' | 'need_more_info' | 'ask_next_city' | 'complete';
    segment?: TripSegment;
    state: ItineraryCollectionState;
  }> {
    try {
      // Get trip info
      const trip = await TripGroupModel.findById(tripId);
      if (!trip) {
        return {
          message: "I couldn't find that trip. Let's try again!",
          action: 'need_more_info',
          state: { stage: 'initial', segments: [] },
        };
      }

      // Get existing segments
      const existingSegments = await TripSegmentModel.findByTrip(tripId);
      
      // Initialize state if needed
      const state: ItineraryCollectionState = currentState || {
        stage: 'initial',
        segments: existingSegments,
      };

      // Parse the user's input
      const parsed = await this.parseItineraryInput(
        userMessage,
        trip.destination,
        existingSegments
      );

      // Update pending segment with new info
      state.pendingSegment = {
        ...state.pendingSegment,
        ...(parsed.city && { city: parsed.city }),
        ...(parsed.country && { country: parsed.country }),
        ...(parsed.startDate && { startDate: parsed.startDate }),
        ...(parsed.endDate && { endDate: parsed.endDate }),
        ...(parsed.accommodation && { accommodation: parsed.accommodation }),
      };

      // Check if we have enough info to create a segment
      if (state.pendingSegment?.city && state.pendingSegment?.startDate && state.pendingSegment?.endDate) {
        // Create the segment
        const segment = await TripSegmentModel.create(
          tripId,
          state.pendingSegment.city,
          new Date(state.pendingSegment.startDate),
          new Date(state.pendingSegment.endDate),
          userId,
          {
            country: state.pendingSegment.country,
            accommodationName: state.pendingSegment.accommodation,
          }
        );

        // Get places count
        const placesCount = await TripSegmentModel.getPlacesCountForCity(tripId, segment.city);

        // Format dates for display
        const startDate = new Date(segment.start_date);
        const endDate = new Date(segment.end_date);
        const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        const dateRange = `${startDate.toLocaleDateString('en-US', dateOptions)} - ${endDate.toLocaleDateString('en-US', dateOptions)}`;

        // Clear pending segment
        state.pendingSegment = undefined;
        state.segments = [...existingSegments, segment];

        // Generate response
        let message = `Got it! ✅ **${segment.city}** (${dateRange})`;
        
        if (segment.accommodation_name) {
          message += `\n🏨 ${segment.accommodation_name}`;
        }
        
        if (placesCount.total > 0) {
          message += `\n📌 You already have ${placesCount.total} places saved there!`;
        }

        message += `\n\nWhere to next? Or say "done" if that's your full itinerary! 🗺️`;

        return {
          message,
          action: 'created_segment',
          segment,
          state: { ...state, stage: 'collecting_city' },
        };
      }

      // Need more info - generate appropriate follow-up question
      let message = '';
      
      if (!state.pendingSegment?.city) {
        // First interaction or need city
        if (existingSegments.length === 0) {
          message = `Excited for ${trip.destination}! 🎉\n\n`;
          message += `Just tell me your plans naturally:\n`;
          message += `• "Bangkok 4 days then Phuket 3 days"\n`;
          message += `• "Dec 6-10 in Osaka, staying at XYZ Hotel"\n\n`;
          message += `I'll organize everything for you! 🗺️`;
        } else {
          message = `Got it! Anywhere else after ${existingSegments[existingSegments.length - 1].city}? 🗺️\n`;
          message += `(or say "that's all" if you're done)`;
        }
        state.stage = 'collecting_city';
      } else if (!state.pendingSegment?.startDate || !state.pendingSegment?.endDate) {
        // Have city, need dates
        message = `Nice! When are you in ${state.pendingSegment.city}? 📅\n`;
        message += `Just say the dates, like "Dec 6 to 10"`;
        state.stage = 'collecting_dates';
      }

      return {
        message,
        action: 'need_more_info',
        state,
      };
    } catch (error) {
      logger.error('[Itinerary] Response generation error:', error);
      return {
        message: "Oops, I had trouble understanding that. Could you try again? 😅",
        action: 'need_more_info',
        state: currentState || { stage: 'initial', segments: [] },
      };
    }
  }

  /**
   * Check if user wants to finish itinerary collection
   */
  static isFinishIntent(message: string): boolean {
    const finishPhrases = [
      'done', "that's it", 'thats it', 'finished', 'complete', 'no more',
      'nope', "that's all", 'thats all', 'nothing else', 'all set'
    ];
    const lower = message.toLowerCase().trim();
    return finishPhrases.some(phrase => lower.includes(phrase));
  }

  /**
   * Generate itinerary summary
   */
  static async generateItinerarySummary(tripId: string): Promise<string> {
    const segments = await TripSegmentModel.findByTripWithStats(tripId);
    const trip = await TripGroupModel.findById(tripId);
    
    if (segments.length === 0) {
      return "No itinerary set up yet! Share your travel dates and cities, and I'll help you plan.";
    }

    let summary = `🗺️ **${trip?.name || 'Your Trip'} Itinerary**\n\n`;

    for (const segment of segments) {
      const startDate = new Date(segment.start_date);
      const endDate = new Date(segment.end_date);
      const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      const dateRange = `${startDate.toLocaleDateString('en-US', dateOptions)} - ${endDate.toLocaleDateString('en-US', dateOptions)}`;
      
      summary += `📍 **${segment.city}** (${dateRange})\n`;
      
      if (segment.accommodation_name) {
        summary += `   🏨 ${segment.accommodation_name}\n`;
      }
      
      summary += `   📌 ${segment.places_count} places saved`;
      if (segment.visited_count > 0) {
        summary += ` (${segment.visited_count} visited)`;
      }
      summary += '\n\n';
    }

    summary += `I'll send you daily recommendations when you arrive in each city! ✨`;

    return summary;
  }

  /**
   * Detect if user is asking about itinerary
   */
  static isItineraryIntent(message: string): boolean {
    const itineraryPhrases = [
      'itinerary', 'staying', 'hotel', 'dates', 'when am i',
      'add city', 'add segment', 'plan my trip', 'trip plan',
      'where am i staying', "where we're staying", 'accommodation',
      'set up', 'setup', 'cities', 'how many days', 'schedule',
      'from', 'to', 'december', 'january', 'february', 'march',
      'april', 'may', 'june', 'july', 'august', 'september',
      'october', 'november', 'dec', 'jan', 'feb', 'mar', 'apr',
      'jun', 'jul', 'aug', 'sep', 'oct', 'nov'
    ];
    
    const lower = message.toLowerCase();
    
    // Check for date patterns like "6th", "10th", "Dec 6"
    const datePattern = /\b\d{1,2}(st|nd|rd|th)?\b.*\b(to|-)?\s*\b\d{1,2}(st|nd|rd|th)?\b/i;
    if (datePattern.test(message)) {
      return true;
    }
    
    return itineraryPhrases.some(phrase => lower.includes(phrase));
  }
}

