// Google Maps Configuration
// Using EXPO_PUBLIC_ prefix makes it available in the app
// @ts-ignore - process.env is available in Expo
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Category Colors
export const CATEGORY_COLORS: Record<string, string> = {
  food: '#FF6B6B',
  shopping: '#FFD93D',
  place: '#4ECDC4',
  activity: '#95E1D3',
  accommodation: '#A8E6CF',
  tip: '#C7CEEA',
};

// Category Emojis
export const CATEGORY_EMOJIS: Record<string, string> = {
  food: '🍽️',
  shopping: '🛍️',
  place: '📍',
  activity: '🎯',
  accommodation: '🏨',
  tip: '💡',
};
