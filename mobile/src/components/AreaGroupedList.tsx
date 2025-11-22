import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  Image,
} from 'react-native';
import { SavedItem, ItemCategory } from '../types';
import { StarRating } from './StarRating';

interface AreaGroupedListProps {
  items: SavedItem[];
  onItemPress: (item: SavedItem) => void;
}

interface Section {
  title: string;
  data: SavedItem[];
}

const CATEGORY_EMOJIS: Record<ItemCategory, string> = {
  [ItemCategory.FOOD]: '🍽️',
  [ItemCategory.ACCOMMODATION]: '🏨',
  [ItemCategory.PLACE]: '📍',
  [ItemCategory.SHOPPING]: '🛍️',
  [ItemCategory.ACTIVITY]: '🎯',
  [ItemCategory.TIP]: '💡',
};

export const AreaGroupedList: React.FC<AreaGroupedListProps> = ({
  items,
  onItemPress,
}) => {
  // Group items by area_name
  const groupedItems = items.reduce((acc, item) => {
    const areaName = item.area_name || 'Other Areas';
    if (!acc[areaName]) {
      acc[areaName] = [];
    }
    acc[areaName].push(item);
    return acc;
  }, {} as Record<string, SavedItem[]>);

  // Convert to sections array
  const sections: Section[] = Object.keys(groupedItems)
    .sort()
    .map((areaName) => ({
      title: areaName,
      data: groupedItems[areaName],
    }));

  const getPlacePhoto = (item: SavedItem): string | null => {
    if (!item.photos_json) return null;
    try {
      const photos = Array.isArray(item.photos_json)
        ? item.photos_json
        : JSON.parse(item.photos_json);
      
      if (photos.length > 0) {
        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=200&photoreference=${photos[0].photo_reference}&key=AIzaSyAiWhzrvdNb2NKSyzWpvNrhImz72I395Qo`;
      }
    } catch {
      return null;
    }
    return null;
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <TouchableOpacity>
        <Text style={styles.sectionExpand}>›</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: { item: SavedItem }) => {
    const photoUrl = getPlacePhoto(item);
    
    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => onItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemContent}>
          {/* Left: Category Emoji + Info */}
          <View style={styles.itemInfo}>
            <Text style={styles.itemEmoji}>{CATEGORY_EMOJIS[item.category]}</Text>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              {item.rating && item.rating > 0 ? (
                <View style={styles.ratingContainer}>
                  <StarRating 
                    rating={item.rating} 
                    reviewCount={item.user_ratings_total}
                    size="small"
                    showReviewCount={false}
                  />
                </View>
              ) : (
                <Text style={styles.itemDescription} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
            </View>
          </View>

          {/* Right: Photo */}
          {photoUrl && (
            <Image
              source={{ uri: photoUrl }}
              style={styles.itemPhoto}
              resizeMode="cover"
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SectionList
      sections={sections}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: '#fff',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  sectionExpand: {
    fontSize: 24,
    color: '#8E8E93',
    fontWeight: '300',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  itemEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  ratingContainer: {
    marginTop: 2,
  },
  itemPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
});

