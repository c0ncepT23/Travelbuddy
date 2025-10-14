import OpenAI from 'openai';
import { config } from '../config/env';
import { AgentContext, ItemCategory, ProcessedContent } from '../types';
import logger from '../config/logger';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export class TravelAgent {
  /**
   * Generate system prompt for the agent
   */
  private static getSystemPrompt(context: AgentContext): string {
    const startDateStr = context.startDate
      ? context.startDate.toLocaleDateString()
      : 'Not set';
    const endDateStr = context.endDate ? context.endDate.toLocaleDateString() : 'Not set';

    return `You are an excited travel companion AI helping users organize their trip research. Your personality is enthusiastic and encouraging, like a friend who's genuinely excited about the upcoming trip.

Current trip: ${context.tripName} to ${context.destination}
Trip dates: ${startDateStr} - ${endDateStr}
Current user: ${context.userName}

Key responsibilities:
1. Process content users share (videos, posts, articles, photos) and extract key information
2. Organize items into categories: food, accommodation, places, shopping, activities, tips
3. Help users remember what they've researched
4. Proactively suggest relevant saved items when users are nearby during the trip
5. Ask if users visited/tried things and track their progress
6. IMPORTANT: Only work with content users share - never suggest new places or items

Tone guidelines:
- Be enthusiastic and encouraging
- Use emojis appropriately to enhance messages (but not overwhelming)
- Keep responses concise and friendly
- Celebrate when users visit places they researched
- Be helpful without being pushy

When responding:
- For content processing: Extract name, category, description, and location if available
- For location suggestions: Be excited but not pushy
- For general chat: Be friendly and helpful
- Keep messages short and conversational`;
  }

  /**
   * Chat with the agent
   */
  static async chat(
    context: AgentContext,
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> {
    try {
      const messages: any[] = [
        { role: 'system', content: this.getSystemPrompt(context) },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: messages,
        temperature: 0.8,
        max_tokens: 500,
      });

      return response.choices[0]?.message?.content || 'Sorry, I had trouble responding.';
    } catch (error) {
      logger.error('Agent chat error:', error);
      throw new Error('Failed to generate response');
    }
  }

  /**
   * Process and categorize content
   */
  static async processContent(
    contentText: string,
    sourceType: string
  ): Promise<ProcessedContent> {
    try {
      const prompt = `Analyze the following ${sourceType} content and extract key information. 

Content:
${contentText}

Extract:
1. Name of the place/restaurant/activity (be specific)
2. Category (choose one: food, accommodation, place, shopping, activity, tip)
3. Brief description (2-3 sentences highlighting key features)
4. Location name (city/area if mentioned)

Respond ONLY with a valid JSON object in this exact format:
{
  "name": "extracted name",
  "category": "one of: food|accommodation|place|shopping|activity|tip",
  "description": "brief description",
  "location_name": "location if mentioned or null"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(
        response.choices[0]?.message?.content || '{}'
      ) as ProcessedContent;

      // Validate the result
      if (!result.name || !result.category || !result.description) {
        throw new Error('Invalid content processing result');
      }

      return result;
    } catch (error) {
      logger.error('Content processing error:', error);
      throw new Error('Failed to process content');
    }
  }

  /**
   * Generate confirmation message after processing content
   */
  static async generateConfirmation(
    itemName: string,
    category: ItemCategory,
    description: string
  ): Promise<string> {
    const categoryEmojis: Record<ItemCategory, string> = {
      food: '🍽️',
      accommodation: '🏨',
      place: '📍',
      shopping: '🛍️',
      activity: '🎯',
      tip: '💡',
    };

    const emoji = categoryEmojis[category];

    const templates = [
      `Got it! Added "${itemName}" to your ${category} list! ${emoji} ${description.substring(0, 50)}...`,
      `Awesome find! "${itemName}" looks amazing! ${emoji} Added to ${category}! ✨`,
      `Ooh, "${itemName}" sounds great! ${emoji} Saved to your ${category} list!`,
      `Perfect! "${itemName}" is now in your ${category} collection! ${emoji}`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Generate location-based suggestion message
   */
  static async generateLocationSuggestion(
    itemName: string,
    category: ItemCategory,
    _description: string,
    distance: number
  ): Promise<string> {
    const distanceStr =
      distance < 100
        ? 'right here'
        : distance < 500
        ? `just ${Math.round(distance)}m away`
        : `about ${(distance / 1000).toFixed(1)}km away`;

    const categoryEmojis: Record<ItemCategory, string> = {
      food: '🍽️',
      accommodation: '🏨',
      place: '📍',
      shopping: '🛍️',
      activity: '🎯',
      tip: '💡',
    };

    const emoji = categoryEmojis[category];

    const templates = [
      `Hey! You're near "${itemName}" - that ${category} spot you saved! ${emoji} It's ${distanceStr}. Want to check it out?`,
      `Ooh! "${itemName}" is ${distanceStr}! ${emoji} That's the ${category} place from your list. Perfect timing?`,
      `You're super close to "${itemName}"! ${emoji} ${distanceStr}. Feel like visiting?`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Generate check-in message after visit
   */
  static async generateCheckInMessage(itemName: string, category: ItemCategory): Promise<string> {
    const categoryEmojis: Record<ItemCategory, string> = {
      food: '🍽️',
      accommodation: '🏨',
      place: '📍',
      shopping: '🛍️',
      activity: '🎯',
      tip: '💡',
    };

    const emoji = categoryEmojis[category];

    const templates = [
      `So, how was "${itemName}"? ${emoji} Worth the hype?`,
      `Did you enjoy "${itemName}"? ${emoji} I'm curious!`,
      `How was your experience at "${itemName}"? ${emoji}`,
      `What did you think of "${itemName}"? ${emoji} Tell me!`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Generate visited confirmation message
   */
  static async generateVisitedConfirmation(
    itemName: string,
    totalVisited: number,
    totalItems: number
  ): Promise<string> {
    const templates = [
      `Yay! Glad you checked out "${itemName}"! 🎉 You've explored ${totalVisited} out of ${totalItems} places now! Keep going!`,
      `Awesome! "${itemName}" ✓ marked! You're ${totalVisited}/${totalItems} through your list! 🌟`,
      `Great! "${itemName}" done! You've visited ${totalVisited} out of ${totalItems} spots! 🚀`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Generate pre-trip reminder
   */
  static async generateTripReminder(
    tripName: string,
    destination: string,
    daysUntil: number,
    stats: {
      totalItems: number;
      foodCount: number;
      placeCount: number;
      shoppingCount: number;
      accommodationCount: number;
    }
  ): Promise<string> {
    const message = `${tripName} to ${destination} in ${daysUntil} days! 🎌✨

Here's what you've researched:
${stats.foodCount > 0 ? `🍽️ ${stats.foodCount} restaurants to try` : ''}
${stats.placeCount > 0 ? `\n📍 ${stats.placeCount} places to visit` : ''}
${stats.shoppingCount > 0 ? `\n🛍️ ${stats.shoppingCount} shopping spots` : ''}
${stats.accommodationCount > 0 ? `\n🏨 ${stats.accommodationCount} accommodations` : ''}

Total: ${stats.totalItems} saved items! 🎉

${
  stats.foodCount > 5
    ? 'Pro tip: Some popular restaurants need reservations! Check if any of yours do. 📞'
    : ''
}

Ready for an amazing trip? I'll be here to help you explore! 🌟`;

    return message;
  }

  /**
   * Check for duplicate items
   */
  static async checkDuplicates(
    newItemName: string,
    existingItems: Array<{ name: string; id: string }>
  ): Promise<{ isDuplicate: boolean; message?: string; matchedItem?: any }> {
    if (existingItems.length === 0) {
      return { isDuplicate: false };
    }

    try {
      const prompt = `Check if "${newItemName}" is the same place/item as any of these:
${existingItems.map((item, i) => `${i + 1}. ${item.name}`).join('\n')}

Respond with JSON:
{
  "is_duplicate": true/false,
  "matched_index": index number if duplicate (null if not)
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      if (result.is_duplicate && result.matched_index !== null) {
        const matchedItem = existingItems[result.matched_index];
        return {
          isDuplicate: true,
          message: `Hey! You already saved "${matchedItem.name}" earlier! 📝 Want to add this as a separate entry anyway?`,
          matchedItem,
        };
      }

      return { isDuplicate: false };
    } catch (error) {
      logger.error('Duplicate check error:', error);
      return { isDuplicate: false };
    }
  }

  /**
   * Extract summary from video transcript
   */
  static async summarizeTranscript(
    transcript: string,
    title: string
  ): Promise<{ places: Array<{ name: string; description: string; location?: string }> }> {
    try {
      const prompt = `Extract all specific places, restaurants, or recommendations from this video:

Title: ${title}
Transcript: ${transcript.substring(0, 3000)}

List each place with:
- Name
- Brief description (what makes it special)
- Location (if mentioned)

Respond with JSON:
{
  "places": [
    {"name": "...", "description": "...", "location": "..."}
  ]
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0]?.message?.content || '{"places":[]}');
    } catch (error) {
      logger.error('Transcript summarization error:', error);
      return { places: [] };
    }
  }
}

