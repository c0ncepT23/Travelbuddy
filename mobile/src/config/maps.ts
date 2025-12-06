// Google Maps Configuration
// Using EXPO_PUBLIC_ prefix makes it available in the app
// @ts-ignore - process.env is available in Expo
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Helper to generate Google Places photo URL
export const getGooglePhotoUrl = (photoReference: string, maxWidth: number = 400): string => {
  if (!photoReference || !GOOGLE_MAPS_API_KEY) return '';
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_MAPS_API_KEY}`;
};

// Parse photos_json and get first photo URL
export const getPlacePhotoUrl = (photosJson: any, maxWidth: number = 400): string | null => {
  if (!photosJson) return null;
  try {
    const photos = Array.isArray(photosJson) ? photosJson : JSON.parse(photosJson);
    if (photos.length > 0 && photos[0].photo_reference) {
      return getGooglePhotoUrl(photos[0].photo_reference, maxWidth);
    }
  } catch {
    return null;
  }
  return null;
};

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
