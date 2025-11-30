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
    userId: string,
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

