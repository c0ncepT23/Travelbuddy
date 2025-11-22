import { SavedItem, ItemCategory } from '../types';

export interface CategoryCluster {
  category: ItemCategory;
  count: number;
  items: SavedItem[];
  centerLat: number;
  centerLng: number;
}

/**
 * Group items by category for map clustering
 */
export function clusterByCategory(items: SavedItem[]): CategoryCluster[] {
  // Group items by category
  const grouped = items.reduce((acc, item) => {
    if (!item.location_lat || !item.location_lng) return acc;
    
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

