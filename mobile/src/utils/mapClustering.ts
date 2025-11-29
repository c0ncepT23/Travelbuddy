import { SavedItem, ItemCategory } from '../types';

export interface CategoryCluster {
  category: ItemCategory;
  count: number;
  items: SavedItem[];
  centerLat: number;
  centerLng: number;
}

/**
 * Check if coordinates are valid and reasonable
 * Filters out 0,0 coordinates and obviously invalid values
 */
function isValidCoordinate(lat: number | undefined | null, lng: number | undefined | null): boolean {
  // Must be defined and be numbers
  if (lat === undefined || lat === null || lng === undefined || lng === null) return false;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  
  // Filter out 0,0 (null island) - this is almost never a valid location
  if (lat === 0 && lng === 0) return false;
  
  // Check valid ranges: lat -90 to 90, lng -180 to 180
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  
  // Filter out very small coordinates that are likely parsing errors
  if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) return false;
  
  return true;
}

/**
 * Group items by category for map clustering
 */
export function clusterByCategory(items: SavedItem[]): CategoryCluster[] {
  // Group items by category - with strict coordinate validation
  const grouped = items.reduce((acc, item) => {
    // Strict validation to prevent floating markers at wrong locations
    if (!isValidCoordinate(item.location_lat, item.location_lng)) return acc;
    
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<ItemCategory, SavedItem[]>);

  // Create clusters with center points
  return Object.entries(grouped).map(([category, categoryItems]) => {
    // Calculate center point (average of all locations)
    const totalLat = categoryItems.reduce((sum, item) => sum + (item.location_lat || 0), 0);
    const totalLng = categoryItems.reduce((sum, item) => sum + (item.location_lng || 0), 0);
    
    return {
      category: category as ItemCategory,
      count: categoryItems.length,
      items: categoryItems,
      centerLat: totalLat / categoryItems.length,
      centerLng: totalLng / categoryItems.length,
    };
  });
}

/**
 * Get category counts for UI display
 */
export function getCategoryCounts(items: SavedItem[]): Record<ItemCategory, number> {
  return items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<ItemCategory, number>);
}

/**
 * Filter items by category
 */
export function filterByCategory(items: SavedItem[], category: ItemCategory | 'all'): SavedItem[] {
  if (category === 'all') return items;
  return items.filter(item => item.category === category);
}

