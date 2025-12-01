/**
 * Day Planning Service
 * Generates optimized daily itineraries from saved places
 * 
 * Features:
 * - Intelligent place selection based on time of day
 * - Route optimization (minimize travel)
 * - Meal time integration
 * - Opening hours consideration
 */

import OpenAI from 'openai';
import { config } from '../config/env';
import { DailyPlanModel } from '../models/dailyPlan.model';
import { SavedItemModel } from '../models/savedItem.model';
import { TripSegmentModel } from '../models/tripSegment.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { DailyPlan, DailyPlanStop, SavedItem, CurrentSegmentInfo } from '../types';
import logger from '../config/logger';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

interface PlannedStop {
  saved_item_id: string;
  name: string;
  category: string;
  planned_time: string;
  duration_minutes: number;
  notes?: string;
  location_lat?: number;
  location_lng?: number;
}

interface GeneratedPlan {
  title: string;
  stops: PlannedStop[];
  summary: string;
  totalDurationMinutes: number;
  totalDistanceMeters: number;
}

interface UserAnchor {
  activity: string;
  timeHint?: 'morning' | 'afternoon' | 'evening' | 'night';
  specificTime?: string;
}

interface ParsedPlanRequest {
  dayNumber?: number;
  date?: string;
  anchors: UserAnchor[];
  isGenericPlan: boolean;
}

export class DayPlanningService {
  /**
   * Check if message is a plan request
   */
  static isPlanIntent(message: string): boolean {
    const planPhrases = [
      'plan my day',
      'plan today',
      'plan the day',
      'create a plan',
      'make a plan',
      'itinerary for today',
      'what should i do today',
      'what to do today',
      'help me plan',
      'suggest a route',
      'where should i go',
      'daily itinerary',
      'day plan',
      'plan for tomorrow',
    ];

    const lower = message.toLowerCase();
    return planPhrases.some(phrase => lower.includes(phrase));
  }

  /**
   * Check if message is adding activities to a specific day
   * e.g., "Day 2 I want to go to Siam Center morning, Chinatown evening"
   */
  static isDayActivityIntent(message: string): boolean {
    const lower = message.toLowerCase();
    
    // Check for day patterns
    const dayPatterns = [
      /day\s*\d+/i,                    // "day 2", "day 3"
      /on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /tomorrow/i,
      /today.*want.*go/i,
      /morning.*evening/i,             // time-based planning
      /want.*go.*to/i,                 // "I want to go to X"
      /have\s*to\s*(go|visit)/i,       // "I have to go to X"
    ];

    return dayPatterns.some(pattern => pattern.test(lower));
  }

  /**
   * Parse user's day planning request with anchors
   */
  static async parseUserPlanRequest(message: string): Promise<ParsedPlanRequest> {
    const lower = message.toLowerCase();
    const anchors: UserAnchor[] = [];
    let dayNumber: number | undefined;
    let isGenericPlan = false;

    // Extract day number
    const dayMatch = lower.match(/day\s*(\d+)/i);
    if (dayMatch) {
      dayNumber = parseInt(dayMatch[1]);
    }

    // Check for time-based activities
    const timePatterns = [
      { pattern: /morning[^,]*(?:go to|visit|at)\s+([^,\.\n]+)/i, time: 'morning' as const },
      { pattern: /afternoon[^,]*(?:go to|visit|at)\s+([^,\.\n]+)/i, time: 'afternoon' as const },
      { pattern: /evening[^,]*(?:go to|visit|at)\s+([^,\.\n]+)/i, time: 'evening' as const },
      { pattern: /(?:go to|visit)\s+([^,]+)\s+(?:in the\s+)?morning/i, time: 'morning' as const },
      { pattern: /(?:go to|visit)\s+([^,]+)\s+(?:in the\s+)?afternoon/i, time: 'afternoon' as const },
      { pattern: /(?:go to|visit)\s+([^,]+)\s+(?:in the\s+)?evening/i, time: 'evening' as const },
    ];

    for (const { pattern, time } of timePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        anchors.push({
          activity: match[1].trim(),
          timeHint: time,
        });
      }
    }

    // Check for general "want to go to X" patterns
    if (anchors.length === 0) {
      const goToPattern = /(?:want to|have to|going to|need to)\s+(?:go to|visit)\s+([^,\.\n]+)/gi;
      let match;
      while ((match = goToPattern.exec(message)) !== null) {
        if (match[1]) {
          anchors.push({
            activity: match[1].trim(),
          });
        }
      }
    }

    // Check for "then" pattern: "X then Y"
    const thenPattern = /([^,]+)\s+then\s+([^,\.\n]+)/i;
    const thenMatch = message.match(thenPattern);
    if (thenMatch && anchors.length === 0) {
      anchors.push({ activity: thenMatch[1].trim(), timeHint: 'morning' });
      anchors.push({ activity: thenMatch[2].trim(), timeHint: 'evening' });
    }

    // If no specific anchors found, it's a generic "plan my day" request
    isGenericPlan = anchors.length === 0;

    return { dayNumber, anchors, isGenericPlan };
  }

  /**
   * Generate plan around user's specified activities
   */
  static async generatePlanWithAnchors(
    tripGroupId: string,
    userId: string,
    anchors: UserAnchor[],
    forDate?: Date
  ): Promise<{ plan: DailyPlan; message: string }> {
    const targetDate = forDate || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Get segment info
    const segmentInfo = await TripSegmentModel.getCurrentSegment(tripGroupId, targetDate);
    const trip = await TripGroupModel.findById(tripGroupId);

    if (!trip) {
      throw new Error('Trip not found');
    }

    // Get available places
    let availablePlaces: SavedItem[];
    if (segmentInfo.segment) {
      availablePlaces = await SavedItemModel.findByCity(
        tripGroupId,
        segmentInfo.segment.city,
        segmentInfo.segment.id
      );
    } else {
      availablePlaces = await SavedItemModel.findByTrip(tripGroupId, { status: 'saved' as any });
    }

    // Try to match user's anchors to saved places
    const matchedAnchors = anchors.map(anchor => {
      const matchedPlace = availablePlaces.find(p => 
        p.name.toLowerCase().includes(anchor.activity.toLowerCase()) ||
        anchor.activity.toLowerCase().includes(p.name.toLowerCase())
      );
      return { ...anchor, matchedPlace };
    });

    // Generate plan with AI, passing the anchors
    const generatedPlan = await this.generateOptimizedPlanWithAnchors(
      availablePlaces,
      segmentInfo,
      trip.destination,
      matchedAnchors
    );

    // Create/update plan in database
    const stops: DailyPlanStop[] = generatedPlan.stops.map((stop, index) => ({
      saved_item_id: stop.saved_item_id,
      order: index,
      planned_time: stop.planned_time,
      duration_minutes: stop.duration_minutes,
      notes: stop.notes,
    }));

    const plan = await DailyPlanModel.create(tripGroupId, targetDate, userId, {
      segmentId: segmentInfo.segment?.id,
      title: generatedPlan.title,
      stops,
      totalDurationMinutes: generatedPlan.totalDurationMinutes,
      totalDistanceMeters: generatedPlan.totalDistanceMeters,
    });

    // Build response message with plan link
    const city = segmentInfo.segment?.city || trip.destination;
    const dayInfo = segmentInfo.dayNumber ? `Day ${segmentInfo.dayNumber}` : dateStr;
    
    let message = `📅 **${dayInfo} in ${city}** - ${generatedPlan.title}\n\n`;
    
    // Show the plan
    for (const stop of generatedPlan.stops) {
      const isUserPick = matchedAnchors.some(a => 
        a.matchedPlace?.id === stop.saved_item_id
      );
      const emoji = this.getCategoryEmoji(stop.category);
      const userBadge = isUserPick ? ' ⭐' : '';
      message += `${emoji} **${stop.planned_time}** - ${stop.name}${userBadge}`;
      if (stop.duration_minutes) {
        message += ` (${stop.duration_minutes} min)`;
      }
      message += '\n';
    }

    message += `\n✅ Saved to your Day Planner!\n`;
    message += `📱 Tap below to view/edit`;

    return { plan, message };
  }

  /**
   * Generate optimized plan with user's anchors
   */
  private static async generateOptimizedPlanWithAnchors(
    places: SavedItem[],
    segmentInfo: CurrentSegmentInfo,
    destination: string,
    anchors: Array<UserAnchor & { matchedPlace?: SavedItem }>
  ): Promise<GeneratedPlan> {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Build place list for AI
    const placeList = places.slice(0, 20).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      rating: p.rating,
      area: p.area_name || p.location_name,
      lat: p.location_lat,
      lng: p.location_lng,
      isMustVisit: p.is_must_visit,
    }));

    // Build anchor info for AI
    const anchorInfo = anchors.map(a => ({
      activity: a.activity,
      timeHint: a.timeHint,
      matchedPlaceId: a.matchedPlace?.id,
      matchedPlaceName: a.matchedPlace?.name,
    }));

    const prompt = `You are a travel planning expert. Create an optimized day plan incorporating the user's specific requests.

CONTEXT:
- Destination: ${destination}
${segmentInfo.segment ? `- City: ${segmentInfo.segment.city}
- Day ${segmentInfo.dayNumber} of ${segmentInfo.totalDays}
- ${segmentInfo.daysRemaining === 0 ? '⚠️ LAST DAY in this city!' : `${segmentInfo.daysRemaining} days remaining`}
- Hotel: ${segmentInfo.segment.accommodation_name || 'Unknown'}` : '- No specific segment'}
- Current time: ${currentHour}:00
- Available hours: ${currentHour < 10 ? '9am' : `${currentHour}:00`} to 9pm

USER'S SPECIFIC REQUESTS (MUST INCLUDE THESE):
${JSON.stringify(anchorInfo, null, 2)}

AVAILABLE PLACES:
${JSON.stringify(placeList, null, 2)}

RULES:
1. MUST include user's requested activities at their preferred times
2. Fill gaps with other saved places that make sense
3. Group nearby places together for efficient routing
4. Include meal stops aligned with meal times (lunch 12-2pm, dinner 6-8pm)
5. Total 4-6 stops for a comfortable day
6. If user's activity isn't in saved places, still include it with best guess timing

Return JSON:
{
  "title": "Day title incorporating user's theme",
  "stops": [
    {
      "saved_item_id": "uuid or 'user_request' if not in saved",
      "name": "Place name",
      "category": "food|place|shopping|activity",
      "planned_time": "HH:MM",
      "duration_minutes": 60,
      "notes": "Optional tip",
      "isUserRequest": true/false
    }
  ],
  "summary": "One sentence describing the day",
  "totalDurationMinutes": 480,
  "totalDistanceMeters": 5000
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      // Filter valid stops (either from saved places or user requests)
      const validStops = (result.stops || []).filter((stop: any) => {
        return stop.saved_item_id === 'user_request' || places.some(p => p.id === stop.saved_item_id);
      });

      return {
        title: result.title || 'Day Plan',
        stops: validStops,
        summary: result.summary || 'Your customized day plan',
        totalDurationMinutes: result.totalDurationMinutes || validStops.length * 90,
        totalDistanceMeters: result.totalDistanceMeters || 5000,
      };
    } catch (error) {
      logger.error('AI plan generation with anchors error:', error);
      return this.generateSimplePlanWithAnchors(places, segmentInfo, anchors);
    }
  }

  /**
   * Fallback simple plan with user anchors
   */
  private static generateSimplePlanWithAnchors(
    _places: SavedItem[],
    _segmentInfo: CurrentSegmentInfo,
    anchors: Array<UserAnchor & { matchedPlace?: SavedItem }>
  ): GeneratedPlan {
    const stops: PlannedStop[] = [];
    
    // Add user's anchors first
    anchors.forEach((anchor, index) => {
      const time = anchor.timeHint === 'morning' ? '10:00' :
                   anchor.timeHint === 'afternoon' ? '14:00' :
                   anchor.timeHint === 'evening' ? '18:00' : `${10 + index * 3}:00`;
      
      if (anchor.matchedPlace) {
        stops.push({
          saved_item_id: anchor.matchedPlace.id,
          name: anchor.matchedPlace.name,
          category: anchor.matchedPlace.category,
          planned_time: time,
          duration_minutes: 90,
          notes: '⭐ Your pick!',
        });
      }
    });

    // Sort by time
    stops.sort((a, b) => a.planned_time.localeCompare(b.planned_time));

    return {
      title: 'Your Custom Day',
      stops,
      summary: 'Plan built around your preferences',
      totalDurationMinutes: stops.length * 90,
      totalDistanceMeters: 3000,
    };
  }

  /**
   * Get emoji for category
   */
  private static getCategoryEmoji(category: string): string {
    const emojis: Record<string, string> = {
      food: '🍽️',
      place: '🏛️',
      shopping: '🛍️',
      activity: '🎯',
      accommodation: '🏨',
      tip: '💡',
    };
    return emojis[category] || '📍';
  }

  /**
   * Generate an optimized day plan
   */
  static async generateDayPlan(
    tripGroupId: string,
    userId: string,
    forDate?: Date
  ): Promise<{ plan: DailyPlan; message: string }> {
    const targetDate = forDate || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Get current segment info
    const segmentInfo = await TripSegmentModel.getCurrentSegment(tripGroupId, targetDate);
    const trip = await TripGroupModel.findById(tripGroupId);

    if (!trip) {
      throw new Error('Trip not found');
    }

    // Get available places
    let availablePlaces: SavedItem[];
    
    if (segmentInfo.segment) {
      // Get places for current city
      availablePlaces = await SavedItemModel.findByCity(
        tripGroupId,
        segmentInfo.segment.city,
        segmentInfo.segment.id
      );
    } else {
      // No segment, get all unvisited places
      availablePlaces = await SavedItemModel.findByTrip(tripGroupId, { status: 'saved' as any });
    }

    // Filter to unvisited only
    const unvisitedPlaces = availablePlaces.filter(p => p.status !== 'visited');

    if (unvisitedPlaces.length === 0) {
      return {
        plan: await DailyPlanModel.create(tripGroupId, targetDate, userId, {
          segmentId: segmentInfo.segment?.id,
          title: `Day Plan - ${dateStr}`,
          stops: [],
        }),
        message: "🎉 Amazing! You've visited all your saved places! Want to add more or explore something new?",
      };
    }

    // Generate optimized plan using AI
    const generatedPlan = await this.generateOptimizedPlan(
      unvisitedPlaces,
      segmentInfo,
      trip.destination
    );

    // Create/update the plan in database
    const stops: DailyPlanStop[] = generatedPlan.stops.map((stop, index) => ({
      saved_item_id: stop.saved_item_id,
      order: index,
      planned_time: stop.planned_time,
      duration_minutes: stop.duration_minutes,
      notes: stop.notes,
    }));

    const plan = await DailyPlanModel.create(tripGroupId, targetDate, userId, {
      segmentId: segmentInfo.segment?.id,
      title: generatedPlan.title,
      stops,
      totalDurationMinutes: generatedPlan.totalDurationMinutes,
      totalDistanceMeters: generatedPlan.totalDistanceMeters,
    });

    // Generate conversational response
    const message = this.formatPlanMessage(generatedPlan, segmentInfo);

    logger.info(`Generated day plan for trip ${tripGroupId} with ${stops.length} stops`);

    return { plan, message };
  }

  /**
   * Create a day plan from a guide video's itinerary
   */
  static async createDayPlanFromGuide(
    tripGroupId: string,
    userId: string,
    dayNumber: number,
    title: string,
    placeNames: string[],
    destination: string
  ): Promise<DailyPlan> {
    // Calculate the date for this day plan (assuming trip start is today or use trip dates)
    const trip = await TripGroupModel.findById(tripGroupId);
    const baseDate = trip?.start_date ? new Date(trip.start_date) : new Date();
    const planDate = new Date(baseDate);
    planDate.setDate(planDate.getDate() + dayNumber - 1);

    // Create stops from place names (without saved items)
    // We'll create placeholder stops that reference the place names
    const stops: DailyPlanStop[] = placeNames.map((placeName, index) => ({
      saved_item_id: undefined, // No saved item yet
      order: index,
      planned_time: this.getDefaultTimeForSlot(index),
      duration_minutes: 90,
      notes: placeName, // Store place name in notes for now
    }));

    // Create the day plan
    const plan = await DailyPlanModel.create(tripGroupId, planDate, userId, {
      title: `Day ${dayNumber}: ${title}`,
      stops,
      metadata: {
        source: 'guide_video',
        destination,
        placeNames,
      },
    });

    logger.info(`Created guide day plan: Day ${dayNumber} for trip ${tripGroupId}`);
    return plan;
  }

  /**
   * Get default time for a slot in the day
   */
  private static getDefaultTimeForSlot(slotIndex: number): string {
    const times = [
      '09:00', '10:30', '12:00', '14:00', '16:00', '18:00', '20:00'
    ];
    return times[Math.min(slotIndex, times.length - 1)];
  }

  /**
   * Use AI to generate an optimized plan
   */
  private static async generateOptimizedPlan(
    places: SavedItem[],
    segmentInfo: CurrentSegmentInfo,
    destination: string
  ): Promise<GeneratedPlan> {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Build place list for AI
    const placeList = places.slice(0, 20).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      rating: p.rating,
      area: p.area_name || p.location_name,
      lat: p.location_lat,
      lng: p.location_lng,
      isMustVisit: p.is_must_visit,
    }));

    const prompt = `You are a travel planning expert. Create an optimized day plan from these saved places.

CONTEXT:
- Destination: ${destination}
${segmentInfo.segment ? `- City: ${segmentInfo.segment.city}
- Day ${segmentInfo.dayNumber} of ${segmentInfo.totalDays}
- ${segmentInfo.daysRemaining === 0 ? '⚠️ LAST DAY in this city!' : `${segmentInfo.daysRemaining} days remaining`}
- Hotel: ${segmentInfo.segment.accommodation_name || 'Unknown'}` : '- No specific segment'}
- Current time: ${currentHour}:00
- Available hours: ${currentHour < 10 ? '9am' : `${currentHour}:00`} to 9pm

AVAILABLE PLACES (${places.length} total):
${JSON.stringify(placeList, null, 2)}

RULES:
1. Select 4-6 places maximum for a comfortable day
2. Prioritize must_visit items and highest rated
3. Group nearby places together
4. Include meal stops (breakfast if morning, lunch around 12-2pm, dinner around 6-8pm)
5. Food places should align with meal times
6. Allow 1-2 hours per attraction, 1 hour for meals
7. If last day, prioritize must-visit items they haven't seen

Return JSON:
{
  "title": "Day title (e.g., 'Dotonbori & Osaka Castle Day')",
  "stops": [
    {
      "saved_item_id": "uuid",
      "name": "Place name",
      "category": "food|place|shopping|activity",
      "planned_time": "HH:MM",
      "duration_minutes": 60,
      "notes": "Optional tip"
    }
  ],
  "summary": "One sentence describing the day",
  "totalDurationMinutes": 480,
  "totalDistanceMeters": 5000
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      // Validate and clean up the response
      const validStops = (result.stops || []).filter((stop: any) => {
        return places.some(p => p.id === stop.saved_item_id);
      });

      return {
        title: result.title || 'Day Plan',
        stops: validStops,
        summary: result.summary || 'Your optimized day plan',
        totalDurationMinutes: result.totalDurationMinutes || validStops.length * 90,
        totalDistanceMeters: result.totalDistanceMeters || 5000,
      };
    } catch (error) {
      logger.error('AI plan generation error:', error);
      
      // Fallback: simple plan based on categories and ratings
      return this.generateSimplePlan(places, segmentInfo);
    }
  }

  /**
   * Fallback simple plan generator
   */
  private static generateSimplePlan(
    places: SavedItem[],
    segmentInfo: CurrentSegmentInfo
  ): GeneratedPlan {
    const now = new Date();
    const currentHour = now.getHours();
    const startHour = Math.max(currentHour, 9);

    // Sort by rating and must_visit
    const sorted = [...places].sort((a, b) => {
      if (a.is_must_visit && !b.is_must_visit) return -1;
      if (!a.is_must_visit && b.is_must_visit) return 1;
      return (b.rating || 0) - (a.rating || 0);
    });

    // Select places by time of day
    const stops: PlannedStop[] = [];
    let time = startHour;

    // Morning food (if before 11am)
    if (startHour < 11) {
      const breakfast = sorted.find(p => p.category === 'food');
      if (breakfast) {
        stops.push({
          saved_item_id: breakfast.id,
          name: breakfast.name,
          category: breakfast.category,
          planned_time: `${time.toString().padStart(2, '0')}:00`,
          duration_minutes: 60,
          location_lat: breakfast.location_lat,
          location_lng: breakfast.location_lng,
        });
        time += 1;
      }
    }

    // Morning attractions
    const morningPlaces = sorted.filter(p => 
      p.category === 'place' || p.category === 'activity'
    ).slice(0, 2);

    for (const place of morningPlaces) {
      if (time >= 12) break;
      stops.push({
        saved_item_id: place.id,
        name: place.name,
        category: place.category,
        planned_time: `${time.toString().padStart(2, '0')}:00`,
        duration_minutes: 90,
        location_lat: place.location_lat,
        location_lng: place.location_lng,
      });
      time += 2;
    }

    // Lunch
    const lunch = sorted.find(p => 
      p.category === 'food' && !stops.some(s => s.saved_item_id === p.id)
    );
    if (lunch && time <= 14) {
      stops.push({
        saved_item_id: lunch.id,
        name: lunch.name,
        category: lunch.category,
        planned_time: '12:30',
        duration_minutes: 60,
        location_lat: lunch.location_lat,
        location_lng: lunch.location_lng,
      });
      time = 14;
    }

    // Afternoon (shopping/activities)
    const afternoonPlaces = sorted.filter(p => 
      (p.category === 'shopping' || p.category === 'activity' || p.category === 'place') &&
      !stops.some(s => s.saved_item_id === p.id)
    ).slice(0, 2);

    for (const place of afternoonPlaces) {
      if (time >= 18) break;
      stops.push({
        saved_item_id: place.id,
        name: place.name,
        category: place.category,
        planned_time: `${time.toString().padStart(2, '0')}:00`,
        duration_minutes: 90,
        location_lat: place.location_lat,
        location_lng: place.location_lng,
      });
      time += 2;
    }

    // Dinner
    const dinner = sorted.find(p => 
      p.category === 'food' && !stops.some(s => s.saved_item_id === p.id)
    );
    if (dinner) {
      stops.push({
        saved_item_id: dinner.id,
        name: dinner.name,
        category: dinner.category,
        planned_time: '18:30',
        duration_minutes: 90,
        location_lat: dinner.location_lat,
        location_lng: dinner.location_lng,
      });
    }

    const city = segmentInfo.segment?.city || 'the city';

    return {
      title: `Exploring ${city}`,
      stops,
      summary: `A day of discovery in ${city} with ${stops.length} amazing stops!`,
      totalDurationMinutes: stops.reduce((sum, s) => sum + s.duration_minutes, 0),
      totalDistanceMeters: 5000,
    };
  }

  /**
   * Format plan as conversational message
   */
  private static formatPlanMessage(
    plan: GeneratedPlan,
    segmentInfo: CurrentSegmentInfo
  ): string {
    const cityName = segmentInfo.segment?.city || 'your destination';
    const dayInfo = segmentInfo.segment 
      ? `Day ${segmentInfo.dayNumber}` 
      : 'Today';

    const categoryEmojis: Record<string, string> = {
      food: '🍽️',
      shopping: '🛍️',
      place: '📍',
      activity: '🎯',
      accommodation: '🏨',
      tip: '💡',
    };

    const timeLabels: Record<string, string> = {
      '09': '☀️ Morning',
      '10': '☀️ Morning',
      '11': '☀️ Late Morning',
      '12': '🍱 Lunch',
      '13': '🍱 Lunch',
      '14': '☀️ Afternoon',
      '15': '☀️ Afternoon',
      '16': '☀️ Late Afternoon',
      '17': '🌆 Evening',
      '18': '🍽️ Dinner',
      '19': '🍽️ Dinner',
      '20': '🌙 Night',
      '21': '🌙 Night',
    };

    let message = `🗓️ **${plan.title}**\n`;
    message += `*${dayInfo} in ${cityName}*\n\n`;

    // Group stops by time period
    let lastTimeLabel = '';
    
    plan.stops.forEach((stop, index) => {
      const hour = stop.planned_time.split(':')[0];
      const timeLabel = timeLabels[hour] || '📍';
      
      if (timeLabel !== lastTimeLabel) {
        message += `**${timeLabel}**\n`;
        lastTimeLabel = timeLabel;
      }

      const emoji = categoryEmojis[stop.category] || '📍';
      message += `${index + 1}. ${emoji} **${stop.name}** (${stop.planned_time})\n`;
      if (stop.notes) {
        message += `   _${stop.notes}_\n`;
      }
    });

    message += `\n📊 **Total:** ${plan.stops.length} stops`;
    
    const hours = Math.floor(plan.totalDurationMinutes / 60);
    const mins = plan.totalDurationMinutes % 60;
    message += ` · ~${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
    
    if (plan.totalDistanceMeters > 0) {
      const km = (plan.totalDistanceMeters / 1000).toFixed(1);
      message += ` · ${km}km`;
    }

    message += `\n\n${plan.summary}`;
    message += `\n\n_Want to modify? Say "swap X with Y" or "remove X"_`;

    return message;
  }

  /**
   * Handle plan modification request
   */
  static async handlePlanModification(
    tripGroupId: string,
    _userId: string,
    message: string
  ): Promise<{ success: boolean; message: string; plan?: DailyPlan }> {
    const plan = await DailyPlanModel.getTodaysPlan(tripGroupId);
    
    if (!plan) {
      return {
        success: false,
        message: "You don't have a plan for today yet. Say 'Plan my day' to create one!",
      };
    }

    const lower = message.toLowerCase();

    // Handle "swap X with Y"
    if (lower.includes('swap') || lower.includes('replace')) {
      return this.handleSwapRequest(plan, message, tripGroupId);
    }

    // Handle "remove X"
    if (lower.includes('remove') || lower.includes('delete') || lower.includes('skip')) {
      return this.handleRemoveRequest(plan, message);
    }

    // Handle "add X"
    if (lower.includes('add')) {
      return this.handleAddRequest(plan, message, tripGroupId);
    }

    // Handle "lock plan"
    if (lower.includes('lock') || lower.includes('confirm') || lower.includes('save')) {
      return {
        success: true,
        message: "✅ Plan locked! Have an amazing day! I'll check in with you this evening. 🎉",
        plan,
      };
    }

    return {
      success: false,
      message: "I didn't understand that modification. Try:\n• 'Swap [place] with [other place]'\n• 'Remove [place]'\n• 'Add [place]'\n• 'Lock plan'",
    };
  }

  /**
   * Handle swap request
   */
  private static async handleSwapRequest(
    plan: DailyPlan,
    message: string,
    tripGroupId: string
  ): Promise<{ success: boolean; message: string; plan?: DailyPlan }> {
    // Get populated plan to match names
    const populated = await DailyPlanModel.getPopulatedPlan(plan.id);
    if (!populated) {
      return { success: false, message: "Couldn't load plan details." };
    }

    // Try to find place names in message
    const lower = message.toLowerCase();
    
    // Find which stop to replace
    const stopToReplace = populated.populatedStops.find(s => 
      lower.includes(s.place.name.toLowerCase())
    );

    if (!stopToReplace) {
      return {
        success: false,
        message: "I couldn't find that place in your plan. Which one did you want to swap?",
      };
    }

    // Find available alternatives
    const availablePlaces = await SavedItemModel.findByTrip(tripGroupId, { status: 'saved' as any });
    const alternatives = availablePlaces.filter(p => 
      !plan.stops.some(s => s.saved_item_id === p.id) &&
      p.category === stopToReplace.place.category
    );

    // Try to find mentioned replacement in message
    const replacement = alternatives.find(p => 
      lower.includes(p.name.toLowerCase())
    );

    if (replacement) {
      const updatedPlan = await DailyPlanModel.swapStop(
        plan.id,
        stopToReplace.saved_item_id,
        replacement.id
      );

      return {
        success: true,
        message: `✅ Swapped **${stopToReplace.place.name}** with **${replacement.name}**!`,
        plan: updatedPlan || undefined,
      };
    }

    // Suggest alternatives
    const suggestions = alternatives.slice(0, 3).map(p => p.name).join(', ');
    return {
      success: false,
      message: `What would you like to swap **${stopToReplace.place.name}** with?\n\nSuggestions: ${suggestions}`,
    };
  }

  /**
   * Handle remove request
   */
  private static async handleRemoveRequest(
    plan: DailyPlan,
    message: string
  ): Promise<{ success: boolean; message: string; plan?: DailyPlan }> {
    const populated = await DailyPlanModel.getPopulatedPlan(plan.id);
    if (!populated) {
      return { success: false, message: "Couldn't load plan details." };
    }

    const lower = message.toLowerCase();
    
    const stopToRemove = populated.populatedStops.find(s => 
      lower.includes(s.place.name.toLowerCase())
    );

    if (!stopToRemove) {
      return {
        success: false,
        message: "Which place did you want to remove from your plan?",
      };
    }

    const updatedPlan = await DailyPlanModel.removeStop(plan.id, stopToRemove.saved_item_id);

    return {
      success: true,
      message: `✅ Removed **${stopToRemove.place.name}** from your plan.`,
      plan: updatedPlan || undefined,
    };
  }

  /**
   * Handle add request
   */
  private static async handleAddRequest(
    plan: DailyPlan,
    message: string,
    tripGroupId: string
  ): Promise<{ success: boolean; message: string; plan?: DailyPlan }> {
    const lower = message.toLowerCase();
    
    // Get available places not in plan
    const availablePlaces = await SavedItemModel.findByTrip(tripGroupId, { status: 'saved' as any });
    const notInPlan = availablePlaces.filter(p => 
      !plan.stops.some(s => s.saved_item_id === p.id)
    );

    const placeToAdd = notInPlan.find(p => 
      lower.includes(p.name.toLowerCase())
    );

    if (placeToAdd) {
      const updatedPlan = await DailyPlanModel.addStop(plan.id, placeToAdd.id);

      return {
        success: true,
        message: `✅ Added **${placeToAdd.name}** to your plan!`,
        plan: updatedPlan || undefined,
      };
    }

    // Suggest places to add
    const suggestions = notInPlan.slice(0, 5).map(p => `• ${p.name}`).join('\n');
    return {
      success: false,
      message: `Which place would you like to add?\n\nAvailable:\n${suggestions}`,
    };
  }

  /**
   * Check if message is a plan modification
   */
  static isPlanModificationIntent(message: string): boolean {
    const modPhrases = [
      'swap', 'replace', 'change',
      'remove', 'delete', 'skip',
      'add', 'include',
      'lock', 'confirm', 'save plan',
      'modify', 'update plan',
    ];

    const lower = message.toLowerCase();
    return modPhrases.some(phrase => lower.includes(phrase));
  }
}

