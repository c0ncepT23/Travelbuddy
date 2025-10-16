import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useItemStore } from '../../stores/itemStore';
import { ItemCategory, ItemStatus } from '../../types';

const CATEGORIES = [
  { id: 'all', name: 'All', emoji: '🌟' },
  { id: ItemCategory.FOOD, name: 'Food', emoji: '🍽️' },
  { id: ItemCategory.PLACE, name: 'Places', emoji: '📍' },
  { id: ItemCategory.SHOPPING, name: 'Shopping', emoji: '🛍️' },
  { id: ItemCategory.ACCOMMODATION, name: 'Hotels', emoji: '🏨' },
  { id: ItemCategory.ACTIVITY, name: 'Activities', emoji: '🎯' },
  { id: ItemCategory.TIP, name: 'Tips', emoji: '💡' },
];

export default function BrowseItemsScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { items, isLoading, fetchTripItems, searchItems, markAsVisited } = useItemStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showVisited, setShowVisited] = useState(false);

  useEffect(() => {
    loadItems();
  }, [tripId, selectedCategory, showVisited]);

  const loadItems = () => {
    const filters: any = {};
    if (selectedCategory !== 'all') {
      filters.category = selectedCategory;
    }
    if (!showVisited) {
      filters.status = ItemStatus.SAVED;
    }
    fetchTripItems(tripId, filters);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchItems(tripId, searchQuery.trim());
    } else {
      loadItems();
    }
  };

  const handleMarkVisited = async (itemId: string, itemName: string) => {
    try {
      await markAsVisited(itemId);
      if (Platform.OS === 'web') {
        window.alert(`✓ Marked "${itemName}" as visited!`);
      } else {
        Alert.alert('Success', `Marked "${itemName}" as visited!`);
      }
      loadItems(); // Refresh list
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert(`Error: ${error.message}`);
      } else {
        Alert.alert('Error', error.message);
      }
    }
  };

  const renderCategoryTab = ({ item }: any) => (
    <TouchableOpacity
      style={[
        styles.categoryTab,
        selectedCategory === item.id && styles.categoryTabActive,
      ]}
      onPress={() => {
        setSelectedCategory(item.id);
        setSearchQuery('');
      }}
    >
      <Text style={styles.categoryEmoji}>{item.emoji}</Text>
      <Text
        style={[
          styles.categoryText,
          selectedCategory === item.id && styles.categoryTextActive,
        ]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: any) => {
    const categoryInfo = CATEGORIES.find((c) => c.id === item.category);
    const isVisited = item.status === ItemStatus.VISITED;
    
    return (
      <View style={styles.itemCard}>
        <TouchableOpacity
          onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
        >
          <View style={styles.itemHeader}>
            <Text style={styles.itemEmoji}>
              {categoryInfo?.emoji || '📌'}
            </Text>
            <View style={styles.itemInfo}>
              <View style={styles.itemNameRow}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name}
                </Text>
                {selectedCategory === 'all' && categoryInfo && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{categoryInfo.name}</Text>
                  </View>
                )}
              </View>
              {item.location_name && (
                <Text style={styles.itemLocation} numberOfLines={1}>
                  📍 {item.location_name}
                </Text>
              )}
            </View>
            {isVisited && (
              <Text style={styles.visitedBadge}>✓</Text>
            )}
          </View>
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        </TouchableOpacity>
        
        {!isVisited && (
          <TouchableOpacity
            style={styles.markVisitedButton}
            onPress={(e) => {
              e.stopPropagation();
              handleMarkVisited(item.id, item.name);
            }}
          >
            <Text style={styles.markVisitedText}>✓ Mark as Visited</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const stats = items.reduce(
    (acc, item) => {
      acc.total++;
      if (item.status === ItemStatus.VISITED) acc.visited++;
      return acc;
    },
    { total: 0, visited: 0 }
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>🔍</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={CATEGORIES}
        renderItem={renderCategoryTab}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.categoryList}
        showsHorizontalScrollIndicator={false}
      />

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {stats.total} items • {stats.visited} visited
        </Text>
        <TouchableOpacity onPress={() => setShowVisited(!showVisited)}>
          <Text style={styles.filterText}>
            {showVisited ? 'Hide' : 'Show'} visited
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.itemList}
        refreshing={isLoading}
        onRefresh={loadItems}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>No items yet</Text>
              <Text style={styles.emptySubtext}>
                Start adding places via chat!
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  searchButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  searchButtonText: {
    fontSize: 20,
  },
  categoryList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
  },
  categoryTabActive: {
    backgroundColor: '#007AFF',
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  categoryTextActive: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  filterText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  itemList: {
    padding: 16,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  categoryBadge: {
    backgroundColor: '#E8F4FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
  },
  itemLocation: {
    fontSize: 14,
    color: '#666',
  },
  visitedBadge: {
    fontSize: 24,
    color: '#34C759',
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  markVisitedButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#34C759',
    borderRadius: 8,
    alignItems: 'center',
  },
  markVisitedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

