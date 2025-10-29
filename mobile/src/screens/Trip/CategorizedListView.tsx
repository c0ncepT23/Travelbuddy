import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  TextInput,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { SavedItem } from '../../types';
import { CATEGORY_COLORS, CATEGORY_EMOJIS } from '../../config/maps';
import { CheckInButton } from './CheckInButton';
import { useCheckInStore } from '../../stores/checkInStore';

interface CategorizedListViewProps {
  items: SavedItem[];
  onItemPress?: (item: SavedItem) => void;
  tripId?: string;
}

interface CategorySection {
  title: string;
  emoji: string;
  data: SavedItem[];
  color: string;
}

const CATEGORY_NAMES: Record<string, string> = {
  food: 'Food & Dining',
  place: 'Must-See Places',
  shopping: 'Shopping',
  activity: 'Activities & Experiences',
  accommodation: 'Where to Stay',
  tip: 'Local Tips',
};

export const CategorizedListView: React.FC<CategorizedListViewProps> = ({
  items,
  onItemPress,
  tripId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const { fetchTimeline } = useCheckInStore();

  // Load check-ins when component mounts
  useEffect(() => {
    if (tripId) {
      console.log('[CategorizedListView] Loading check-ins for trip:', tripId);
      fetchTimeline(tripId);
    }
  }, [tripId]);

  // Categorize and filter items
  const sections = useMemo(() => {
    const filtered = items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const categorized: Record<string, SavedItem[]> = {};
    filtered.forEach(item => {
      if (!categorized[item.category]) {
        categorized[item.category] = [];
      }
      categorized[item.category].push(item);
    });

    return Object.entries(categorized).map(([category, items]): CategorySection => ({
      title: CATEGORY_NAMES[category] || category,
      emoji: CATEGORY_EMOJIS[category] || '📍',
      data: collapsedSections.has(category) ? [] : items,
      color: CATEGORY_COLORS[category] || '#4ECDC4',
    }));
  }, [items, searchQuery, collapsedSections]);

  const toggleSection = (category: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedSections(newCollapsed);
  };

  const openNavigation = (item: SavedItem) => {
    if (item.location_lat && item.location_lng) {
      const url = Platform.select({
        ios: `maps:0,0?q=${item.name}@${item.location_lat},${item.location_lng}`,
        android: `geo:0,0?q=${item.location_lat},${item.location_lng}(${item.name})`,
        default: `https://www.google.com/maps/search/?api=1&query=${item.location_lat},${item.location_lng}`,
      });
      Linking.openURL(url);
    }
  };

  const getPriceIndicator = (description: string): string => {
    if (description?.includes('$$$')) return '$$$';
    if (description?.includes('$$')) return '$$';
    if (description?.includes('$')) return '$';
    return '';
  };

  const renderItem = ({ item }: { item: SavedItem }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => onItemPress?.(item)}
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        <View style={[styles.itemIcon, { backgroundColor: CATEGORY_COLORS[item.category] + '20' }]}>
          <Text style={styles.itemEmoji}>{CATEGORY_EMOJIS[item.category]}</Text>
        </View>
        
        <View style={styles.itemDetails}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.itemBadges}>
              {/* Location Confidence Badge */}
              {item.location_lat && item.location_lng && (
                <View style={[
                  styles.confidenceBadge,
                  item.location_confidence === 'high' ? styles.confidenceHigh :
                  item.location_confidence === 'medium' ? styles.confidenceMedium :
                  styles.confidenceLow
                ]}>
                  <Text style={styles.confidenceDot}>●</Text>
                </View>
              )}
              {getPriceIndicator(item.description) && (
                <Text style={styles.priceIndicator}>
                  {getPriceIndicator(item.description)}
                </Text>
              )}
            </View>
          </View>
          
          <Text style={styles.itemLocation} numberOfLines={1}>
            📍 {item.location_name || 'Location not specified'}
          </Text>
          
          {item.description && (
            <Text style={styles.itemDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          
          <View style={styles.itemActions}>
            <CheckInButton item={item} />
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: CATEGORY_COLORS[item.category] }]}
              onPress={() => openNavigation(item)}
            >
              <Text style={styles.actionButtonText}>Navigate</Text>
            </TouchableOpacity>
            
            {item.original_source_url && (
              <TouchableOpacity
                style={styles.youtubeButton}
                onPress={() => {
                  const url = item.original_source_url;
                  if (!url) return;
                  if (Platform.OS === 'web') {
                    window.open(url, '_blank');
                  } else {
                    Linking.openURL(url);
                  }
                }}
              >
                <Text style={styles.youtubeIcon}>▶</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: CategorySection }) => {
    const category = Object.entries(CATEGORY_NAMES).find(([_, name]) => name === section.title)?.[0] || '';
    const isCollapsed = collapsedSections.has(category);
    
    return (
      <TouchableOpacity
        style={[styles.sectionHeader, { borderLeftColor: section.color }]}
        onPress={() => toggleSection(category)}
        activeOpacity={0.8}
      >
        <View style={styles.sectionHeaderContent}>
          <Text style={styles.sectionEmoji}>{section.emoji}</Text>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={[styles.countBadge, { backgroundColor: section.color + '20' }]}>
            <Text style={[styles.countText, { color: section.color }]}>
              {section.data.length || items.filter(i => i.category === category).length}
            </Text>
          </View>
        </View>
        <Text style={styles.collapseIcon}>
          {isCollapsed ? '▶' : '▼'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search in this trip..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {items.length} total places • {sections.length} categories
        </Text>
      </View>

      {/* Categorized List */}
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No places found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search term' : 'Add places via the AI assistant'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  clearButton: {
    position: 'absolute',
    right: 24,
    top: '50%',
    marginTop: -10,
  },
  clearButtonText: {
    fontSize: 18,
    color: '#6B7280',
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
  },
  statsText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    borderLeftWidth: 4,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },
  collapseIcon: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
  },
  itemCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F8F9FA',
  },
  itemContent: {
    flexDirection: 'row',
    padding: 12,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemEmoji: {
    fontSize: 24,
  },
  itemDetails: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  itemBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confidenceBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confidenceDot: {
    fontSize: 8,
    lineHeight: 12,
  },
  confidenceHigh: {
    backgroundColor: '#10B981',
  },
  confidenceMedium: {
    backgroundColor: '#F59E0B',
  },
  confidenceLow: {
    backgroundColor: '#EF4444',
  },
  priceIndicator: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  itemLocation: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 8,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  youtubeButton: {
    width: 32,
    height: 32,
    backgroundColor: '#FF0000',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  youtubeIcon: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default CategorizedListView;
