import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Image,
  Linking,
  Share,
} from 'react-native';
import { useTripStore } from '../../stores/tripStore';
import { useItemStore } from '../../stores/itemStore';
import { useLocationStore } from '../../stores/locationStore';
import { format } from 'date-fns';
import {
  Trip,
  ItemCategory,
  ItemStatus,
  SavedItem,
  TagFacet,
  TagFilter,
  TagGroupItems,
} from '../../types';

const CATEGORIES = [
  { id: 'all', name: 'All', emoji: '✨', count: 0 },
  { id: ItemCategory.FOOD, name: 'Food', emoji: '🍽️', count: 0 },
  { id: ItemCategory.PLACE, name: 'Places', emoji: '📍', count: 0 },
  { id: ItemCategory.SHOPPING, name: 'Shopping', emoji: '🛍️', count: 0 },
];

const CATEGORY_TAG_PRIORITY: Record<string, string[]> = {
  all: ['vibe', 'food.dish', 'places.type', 'shopping.type', 'neighborhood'],
  [ItemCategory.FOOD]: ['food.dish', 'food.style', 'neighborhood', 'vibe'],
  [ItemCategory.PLACE]: ['places.type', 'neighborhood', 'vibe'],
  [ItemCategory.SHOPPING]: ['shopping.type', 'neighborhood', 'price', 'vibe'],
};

const TAG_GROUP_LABELS: Record<string, { title: string; emoji: string }> = {
  'food.dish': { title: 'Food Collections', emoji: '🍽️' },
  'food.style': { title: 'Food Styles', emoji: '🍜' },
  'food.drink': { title: 'Drinks & Sips', emoji: '🍹' },
  neighborhood: { title: 'Neighborhoods', emoji: '🗺️' },
  cuisine: { title: 'Cuisine Spotlight', emoji: '🍱' },
  price: { title: 'Budget Vibes', emoji: '💰' },
  vibe: { title: 'Smart Collections', emoji: '✨' },
  'places.type': { title: 'Places to Explore', emoji: '📍' },
  'shopping.type': { title: 'Shopping Finds', emoji: '🛍️' },
};

export default function TripDetailScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const tripStore = useTripStore();
  const {
    currentTrip,
    currentTripMembers,
    fetchTripDetails,
    fetchTripMembers,
    leaveTrip,
    updateTripBanner,
  } = tripStore;
  const maybeSetCurrentTrip = (tripStore as { setCurrentTrip?: (trip: Trip | null) => void }).setCurrentTrip;
  const setCurrentTrip = typeof maybeSetCurrentTrip === 'function' ? maybeSetCurrentTrip : undefined;
  const {
    items,
    fetchTripItems,
    fetchTagFacets,
    fetchItemsGroupedByTag,
    markAsVisited,
    setItems,
    clearItems,
  } = useItemStore();
  const { location, isTracking, startTracking, stopTracking, updateLocation } = useLocationStore();
  const [activeTab, setActiveTab] = useState<'hub' | 'visited'>('hub');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showBannerInput, setShowBannerInput] = useState(false);
  const [selectedTag, setSelectedTag] = useState<TagFilter | null>(null);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [facetGroups, setFacetGroups] = useState<string[]>([]);
  const [facetsByGroup, setFacetsByGroup] = useState<Record<string, TagFacet[]>>({});
  const [collectionsByGroup, setCollectionsByGroup] = useState<Record<string, TagGroupItems[]>>({});
  const [savedItemsCache, setSavedItemsCache] = useState<SavedItem[] | null>(null);
  const [visitedItemsCache, setVisitedItemsCache] = useState<SavedItem[] | null>(null);

  const applyFilters = useCallback(
    (source: SavedItem[]) => {
      return source.filter((item) => {
        if (selectedCategory !== 'all' && item.category !== (selectedCategory as ItemCategory)) {
          return false;
        }
        if (selectedTag) {
          return (
            item.tags?.some(
              (tag) => tag.group === selectedTag.group && tag.value === selectedTag.value
            ) ?? false
          );
        }
        return true;
      });
    },
    [selectedCategory, selectedTag]
  );

  const loadItems = useCallback(
    async (forceRefresh = false) => {
      try {
        if (activeTab === 'hub') {
          let source = savedItemsCache;
          if (!source || forceRefresh) {
            const fetched = await fetchTripItems(tripId, { status: ItemStatus.SAVED });
            setSavedItemsCache(fetched);
            source = fetched;
          }
          const filtered = applyFilters(source ?? []);
          setItems(filtered);
        } else {
          let source = visitedItemsCache;
          if (!source || forceRefresh) {
            const fetchedVisited = await fetchTripItems(tripId, { status: ItemStatus.VISITED });
            setVisitedItemsCache(fetchedVisited);
            source = fetchedVisited;
          }
          const filteredVisited = (source ?? []).filter((item) => item.status === ItemStatus.VISITED);
          setItems(filteredVisited);
        }
      } catch (error) {
        console.error('Load items error:', error);
      }
    },
    [
      activeTab,
      applyFilters,
      fetchTripItems,
      tripId,
      savedItemsCache,
      visitedItemsCache,
      setItems,
    ]
  );

  const loadTripData = useCallback(async () => {
    setSavedItemsCache(null);
    setVisitedItemsCache(null);
    // Clear UI list immediately to avoid showing stale items from previous trip
    clearItems();
    // Clear current trip to avoid showing previous details while fetching
    setCurrentTrip?.(null);
    await Promise.all([fetchTripDetails(tripId), fetchTripMembers(tripId)]);
    await loadItems(true);
  }, [fetchTripDetails, fetchTripMembers, tripId, loadItems, clearItems, setCurrentTrip]);

  const getPreferredGroups = useCallback(
    (categoryKey: string) =>
      CATEGORY_TAG_PRIORITY[categoryKey] ?? CATEGORY_TAG_PRIORITY.all,
    []
  );

  const formatTagValue = (value: string) =>
    value
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const getGroupLabel = (group: string) =>
    TAG_GROUP_LABELS[group]?.title ?? 'Smart Collections';

  const getGroupEmoji = (group: string) =>
    TAG_GROUP_LABELS[group]?.emoji ?? '✨';

  const refreshTagFacets = useCallback(async () => {
    if (activeTab !== 'hub') return;
    setIsLoadingCollections(true);
    try {
      const categoryFilter =
        selectedCategory !== 'all' ? (selectedCategory as ItemCategory) : undefined;

      const facets = await fetchTagFacets(tripId, {
        category: categoryFilter,
        top: 24,
      });

      const groupedByGroup = facets.reduce<Record<string, TagFacet[]>>((acc, facet) => {
        if (!acc[facet.group]) {
          acc[facet.group] = [];
        }
        acc[facet.group].push(facet);
        return acc;
      }, {});

      const preferredGroups = getPreferredGroups(categoryFilter ?? 'all');
      const orderedGroups = [
        ...preferredGroups.filter((group) => (groupedByGroup[group]?.length ?? 0) > 0),
        ...Object.keys(groupedByGroup).filter(
          (group) =>
            !preferredGroups.includes(group) && (groupedByGroup[group]?.length ?? 0) > 0
        ),
      ];

      const nextFacetsByGroup: Record<string, TagFacet[]> = {};
      orderedGroups.forEach((group) => {
        const topFacets = (groupedByGroup[group] ?? [])
          .slice()
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);
        if (topFacets.length > 0) {
          nextFacetsByGroup[group] = topFacets;
        }
      });

      const availableGroups = Object.keys(nextFacetsByGroup);
      if (availableGroups.length === 0) {
        setFacetGroups([]);
        setFacetsByGroup({});
        setCollectionsByGroup({});
        setSelectedTag(null);
        return;
      }

      if (
        selectedTag &&
        (!nextFacetsByGroup[selectedTag.group] ||
          !nextFacetsByGroup[selectedTag.group].some((facet) => facet.value === selectedTag.value))
      ) {
        setSelectedTag(null);
      }

      setFacetGroups(availableGroups);
      setFacetsByGroup(nextFacetsByGroup);

      const groupsForCollections = availableGroups.slice(0, 3);
      if (groupsForCollections.length === 0) {
        setCollectionsByGroup({});
      } else {
        const results = await Promise.all(
          groupsForCollections.map(async (group) => {
            const topValues = nextFacetsByGroup[group].slice(0, 3).map((facet) => facet.value);
            if (topValues.length === 0) {
              return [group, [] as TagGroupItems[]] as const;
            }
            const grouped = await fetchItemsGroupedByTag(tripId, group, {
              category: categoryFilter,
              tagValues: topValues,
              limitPerTag: 4,
            });
            return [group, grouped] as const;
          })
        );

        const nextCollections: Record<string, TagGroupItems[]> = {};
        results.forEach(([group, data]) => {
          nextCollections[group] = data as TagGroupItems[];
        });
        setCollectionsByGroup(nextCollections);
      }
    } catch (error) {
      console.error('Smart collections error:', error);
      setFacetGroups([]);
      setFacetsByGroup({});
      setCollectionsByGroup({});
      setSelectedTag(null);
    } finally {
      setIsLoadingCollections(false);
    }
  }, [
    activeTab,
    fetchItemsGroupedByTag,
    fetchTagFacets,
    getPreferredGroups,
    selectedCategory,
    selectedTag,
    tripId,
  ]);

  useEffect(() => {
    loadTripData();
  }, [loadTripData]);

  // Start location tracking when entering trip
  useEffect(() => {
    const initLocationTracking = async () => {
      try {
        if (!isTracking) {
          await startTracking();
        }
      } catch (error) {
        console.error('Failed to start location tracking:', error);
        // Don't show alert - location is optional
      }
    };

    initLocationTracking();

    return () => {
      stopTracking();
    };
  }, [isTracking, startTracking, stopTracking]);

  // Send location updates to backend when location changes
  useEffect(() => {
    if (location && tripId) {
      updateLocation(tripId, location);
    }
  }, [location, tripId, updateLocation]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (activeTab === 'hub') {
      refreshTagFacets();
    } else {
      setSelectedTag(null);
      setFacetGroups([]);
      setFacetsByGroup({});
      setCollectionsByGroup({});
    }
  }, [activeTab, refreshTagFacets]);

  const handleTagSelect = (facet: TagFacet) => {
    if (selectedTag && selectedTag.group === facet.group && selectedTag.value === facet.value) {
      setSelectedTag(null);
    } else {
      setSelectedTag({ group: facet.group, value: facet.value });
    }
  };

  const handleClearTag = () => setSelectedTag(null);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedTag(null);
  };

  const handleFileSelect = (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      if (Platform.OS === 'web') {
        window.alert('Image size should be less than 5MB');
      } else {
        Alert.alert('Error', 'Image size should be less than 5MB');
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target?.result as string;
        await updateTripBanner(tripId, base64);
        setShowBannerInput(false);
        await loadTripData();
        if (Platform.OS === 'web') {
          window.alert('Banner updated! 🎉');
        } else {
          Alert.alert('Success', 'Banner updated!');
        }
      } catch (error: any) {
        if (Platform.OS === 'web') {
          window.alert(`Error: ${error.message}`);
        } else {
          Alert.alert('Error', error.message);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadBanner = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = handleFileSelect;
    input.click();
  };

  const openChat = () => {
    navigation.navigate('Chat', { tripId });
  };

  const handleLeave = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to leave this trip?')) {
        leaveTrip(tripId)
          .then(() => navigation.goBack())
          .catch((error: any) => window.alert(`Error: ${error.message}`));
      }
    } else {
      Alert.alert(
        'Leave Trip',
        'Are you sure you want to leave this trip?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              try {
                await leaveTrip(tripId);
                navigation.goBack();
              } catch (error: any) {
                Alert.alert('Error', error.message);
              }
            },
          },
        ]
      );
    }
  };

  const handleMarkAsVisited = async (itemId: string) => {
    try {
      await markAsVisited(itemId);
      if (Platform.OS === 'web') {
        window.alert('VISITED! ✅');
      } else {
        Alert.alert('Success', 'Marked as visited!');
      }
      await loadItems(true);
      await refreshTagFacets();
      setVisitedItemsCache(null);
      // Switch to visited log to show the new entry
      setTimeout(() => {
        setActiveTab('visited');
      }, 300);
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert(`Error: ${error.message}`);
      } else {
        Alert.alert('Error', error.message);
      }
    }
  };

  // Memos must be declared before any return to keep hook order stable
  const hubSourceItems = useMemo(() => savedItemsCache ?? items, [savedItemsCache, items]);
  const categoriesWithCounts = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        ...cat,
        count:
          cat.id === 'all'
            ? hubSourceItems.length
            : hubSourceItems.filter((item) => item.category === cat.id).length,
      })),
    [hubSourceItems]
  );
  const visitedItemsList = useMemo(
    () => (visitedItemsCache ?? items).filter((i) => i.status === ItemStatus.VISITED),
    [visitedItemsCache, items]
  );
  const visitedCount = visitedItemsList.length;

  if (!currentTrip) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const getCategoryEmoji = (category: ItemCategory) => {
    const cat = CATEGORIES.find((c) => c.id === category);
    return cat?.emoji || '📌';
  };

  const getCategoryColor = (category: ItemCategory) => {
    const colors: any = {
      food: { bg: '#DBEAFE', border: '#1E40AF' },      // Blue tones
      place: { bg: '#D1FAE5', border: '#059669' },     // Green tones
      shopping: { bg: '#FEF3C7', border: '#D97706' },  // Amber tones
      accommodation: { bg: '#E0E7FF', border: '#4F46E5' }, // Indigo
      activity: { bg: '#FFEDD5', border: '#EA580C' },  // Orange
      tip: { bg: '#F3F4F6', border: '#374151' },       // Gray
    };
    return colors[category] || { bg: '#E5E7EB', border: '#6B7280' };
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'youtube':
        return '▶️'; // YouTube icon
      case 'reddit':
        return '🤖'; // Reddit icon
      case 'instagram':
        return '📷'; // Instagram icon
      default:
        return '🔗'; // Generic link
    }
  };

  const openSourceUrl = (url: string | undefined) => {
    if (!url) {
      Alert.alert('No Source', 'This item doesn\'t have a source link');
      return;
    }
    
    Linking.openURL(url).catch((err) => {
      Alert.alert('Error', 'Could not open link');
      console.error('Error opening URL:', err);
    });
  };

  const handleShareVisitedPlaces = async () => {
    const visitedItems = items.filter((item) => item.status === ItemStatus.VISITED);
    
    if (visitedItems.length === 0) {
      Alert.alert('Nothing to Share', 'You haven\'t visited any places yet!');
      return;
    }

    // Create a shareable link (placeholder for now, you'll implement deep linking later)
    const shareUrl = `https://travelagent.app/trips/${tripId}/visited`;
    
    // Format the visited places list
    const placesList = visitedItems
      .map((item, index) => `${index + 1}. ${item.name} - ${item.location_name || 'Unknown location'}`)
      .join('\n');

    const message = `🎌 Check out my trip to ${currentTrip?.destination}! 🗺️\n\nI've visited ${visitedItems.length} amazing place(s):\n\n${placesList}\n\n✨ View my journey: ${shareUrl}`;

    try {
      const result = await Share.share({
        message: message,
        url: shareUrl, // iOS will use this
        title: `My ${currentTrip?.name} Trip`,
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log('Shared with activity type:', result.activityType);
        } else {
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        console.log('Share dismissed');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to share: ' + error.message);
    }
  };

  const openItemInMaps = (item: SavedItem) => {
    try {
      const lat = (item as any).location_lat;
      const lng = (item as any).location_lng;
      const label = encodeURIComponent(item.name || 'Location');
      if (lat && lng) {
        const geoUrl = Platform.OS === 'ios'
          ? `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`
          : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
        Linking.openURL(geoUrl);
      } else if (item.location_name) {
        const query = encodeURIComponent(item.location_name);
        const url = Platform.OS === 'ios'
          ? `http://maps.apple.com/?q=${query}`
          : `geo:0,0?q=${query}`;
        Linking.openURL(url);
      } else {
        Alert.alert('No Location', 'No coordinates or location name to map');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to open maps');
    }
  };

  // Hub Tab: Card-based items with AI VIBE CHECK
  const renderHubItem = (item: SavedItem) => {
    const colors = getCategoryColor(item.category);
    
    return (
      <View key={item.id} style={styles.chunkyCard}>
        <View style={styles.hubCardHeader}>
          <View style={styles.hubCardTitleContainer}>
            <Text style={styles.hubCardTitle}>{item.name}</Text>
            {item.location_name && (
              <Text style={styles.hubCardLocation}>
                📍 {item.location_name}
              </Text>
            )}
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={styles.categoryBadgeEmoji}>{getCategoryEmoji(item.category)}</Text>
          </View>
        </View>

        {item.tags && item.tags.length > 0 && (
          <View style={styles.itemTagRow}>
            {item.tags.slice(0, 3).map((tag) => (
              <View key={`${tag.group}:${tag.value}`} style={styles.itemTagBadge}>
                <Text style={styles.itemTagBadgeText}>{formatTagValue(tag.value)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* AI VIBE CHECK */}
        {item.description && (
          <View style={styles.vibeCheckContainer}>
            <View style={styles.vibeCheckHeader}>
              <Text style={styles.vibeCheckLabel}>AI VIBE CHECK:</Text>
              {item.original_source_url && (
                <TouchableOpacity 
                  style={styles.sourceIconButton}
                  onPress={() => openSourceUrl(item.original_source_url)}
                >
                  <Text style={styles.sourceIcon}>{getSourceIcon(item.original_source_type)}</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.vibeCheckText}>"{item.description}"</Text>
            {item.source_title && (
              <Text style={styles.vibeCheckSource}>Source: {item.source_title}</Text>
            )}
          </View>
        )}

        {/* Chunky Action Buttons */}
        <View style={styles.hubCardActions}>
          <TouchableOpacity style={[styles.chunkyButton, styles.mapButton]}>
            <Text style={styles.mapButtonText}>MAP IT 🗺️</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.chunkyButton, styles.visitButton]}
            onPress={() => handleMarkAsVisited(item.id)}
          >
            <Text style={styles.visitButtonText}>MARK AS VISITED 💯</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Visited Log Tab: Timeline with chunky style
  const renderVisitedItem = (item: SavedItem, index: number) => {
    const colors = getCategoryColor(item.category);
    
    return (
      <View key={item.id} style={[styles.chunkyCard, styles.visitedCard]}>
        <View style={styles.visitedCardContent}>
          <View style={styles.visitedIconTime}>
            <Text style={styles.visitedEmoji}>{getCategoryEmoji(item.category)}</Text>
            <Text style={styles.visitedTime}>
              {format(new Date(item.updated_at), 'h:mm')}
              <Text style={styles.visitedPeriod}>{format(new Date(item.updated_at), 'a')}</Text>
            </Text>
          </View>
          <View style={styles.visitedInfo}>
            <View style={styles.visitedTitleRow}>
              <Text style={styles.visitedTitle}>{item.name}</Text>
              {item.original_source_url && (
                <TouchableOpacity 
                  style={styles.visitedSourceButton}
                  onPress={() => openSourceUrl(item.original_source_url)}
                >
                  <Text style={styles.visitedSourceIcon}>{getSourceIcon(item.original_source_type)}</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.visitedLocation}>
              CHECKED IN: {item.location_name || 'Location'}
            </Text>
            <View style={[styles.visitedBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <Text style={styles.visitedBadgeText}>{item.category.toUpperCase()} VIBE</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // moved memos earlier to avoid conditional hooks

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        bounces={true}
        nestedScrollEnabled={true}
      >
        {/* CHUNKY BANNER with Diagonal Stripes */}
        <TouchableOpacity 
          style={styles.bannerContainer}
          onPress={() => setShowBannerInput(true)}
        >
          {currentTrip.banner_url ? (
            <>
              <Image 
                source={{ uri: currentTrip.banner_url }} 
                style={styles.bannerImage}
                resizeMode="cover"
              />
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerTripName}>{currentTrip.name.toUpperCase()}</Text>
              </View>
            </>
          ) : (
            <View style={styles.bannerPlaceholder}>
              <Text style={styles.bannerTripName}>{currentTrip.name.toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Banner Upload Options */}
        {showBannerInput && (
          <View style={styles.bannerInputContainer}>
            <Text style={styles.uploadTitle}>Upload Banner Image</Text>
            <TouchableOpacity 
              style={[styles.chunkyButton, styles.uploadButton]}
              onPress={handleUploadBanner}
            >
              <Text style={styles.uploadText}>📁 Choose Image</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.chunkyButton, styles.cancelButton]}
              onPress={() => setShowBannerInput(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* TRIP SQUAD - Compact */}
        <View style={styles.tripSquadSection}>
          <Text style={styles.tripSquadLabel}>Trip Squad</Text>
          <View style={styles.membersRow}>
            {currentTripMembers.slice(0, 2).map((member, index) => (
              <View 
                key={member.id} 
                style={[
                  styles.squadAvatar,
                  { 
                    backgroundColor: index === 0 ? '#A855F7' : '#14B8A6',
                    zIndex: currentTripMembers.length - index 
                  }
                ]}
              >
                <Text style={styles.squadAvatarText}>
                  {member.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
            {currentTripMembers.length > 2 && (
              <View style={[styles.squadAvatar, styles.squadMore]}>
                <Text style={styles.squadAvatarText}>+</Text>
              </View>
            )}
          </View>
        </View>

        {/* CHUNKY TAB NAVIGATION */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.chunkyTab, activeTab === 'hub' && styles.chunkyTabActive]}
            onPress={() => setActiveTab('hub')}
          >
            <Text style={[styles.tabText, activeTab === 'hub' && styles.tabTextActive]}>
              Saved Ideas 💡
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chunkyTab, activeTab === 'visited' && styles.chunkyTabActive]}
            onPress={() => setActiveTab('visited')}
          >
            <Text style={[styles.tabText, activeTab === 'visited' && styles.tabTextActive]}>
              Visited Log 📸
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hub Tab Content */}
        {activeTab === 'hub' && (
          <View style={styles.tabContent}>
            <Text style={styles.filterVibesTitle}>Filter Vibes:</Text>
            
            {/* Category Pills */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              nestedScrollEnabled={true}
            >
              {categoriesWithCounts.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.chunkyButton,
                    styles.categoryPill,
                    selectedCategory === cat.id && styles.categoryPillActive,
                  ]}
                  onPress={() => handleCategoryChange(cat.id)}
                >
                  <Text style={[
                    styles.categoryPillText,
                    selectedCategory === cat.id && styles.categoryPillTextActive,
                  ]}>
                    {cat.emoji} {cat.name} ({cat.count})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Smart Collections & Tag Chips */}
            {isLoadingCollections && (
              <View style={styles.smartLoading}>
                <Text style={styles.smartLoadingText}>Curating smart collections...</Text>
              </View>
            )}

            {facetGroups.map((group) => {
              const facets = facetsByGroup[group] ?? [];
              if (facets.length === 0) {
                return null;
              }
              const isGroupSelected = selectedTag?.group === group;
              const collections = collectionsByGroup[group] ?? [];
              const showCollections = !selectedTag || isGroupSelected;

              return (
                <View key={group} style={styles.smartCollectionsContainer}>
                  <View style={styles.smartCollectionsHeader}>
                    <Text style={styles.smartCollectionsTitle}>
                      {getGroupEmoji(group)} {getGroupLabel(group)}
                    </Text>
                    {isGroupSelected && (
                      <TouchableOpacity
                        style={[styles.chunkyButton, styles.clearTagButton]}
                        onPress={handleClearTag}
                      >
                        <Text style={styles.clearTagButtonText}>Clear filter</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.tagChipRow}
                  >
                    {facets.map((facet) => {
                      const isActive =
                        selectedTag?.group === group && selectedTag?.value === facet.value;
                      return (
                        <TouchableOpacity
                          key={`${facet.group}:${facet.value}`}
                          style={[
                            styles.tagChip,
                            isActive && styles.tagChipActive,
                          ]}
                          onPress={() => handleTagSelect(facet)}
                        >
                          <Text
                            style={[
                              styles.tagChipText,
                              isActive && styles.tagChipTextActive,
                            ]}
                          >
                            {formatTagValue(facet.value)} ({facet.count})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {showCollections && collections.length > 0 && (
                    <View style={styles.collectionList}>
                      {collections.map((collection) => (
                        <View
                          key={`${group}-${collection.value}`}
                          style={styles.collectionSection}
                        >
                          <View style={styles.collectionHeader}>
                            <Text style={styles.collectionTitle}>
                              {formatTagValue(collection.value)}
                            </Text>
                            <TouchableOpacity
                              onPress={() =>
                                setSelectedTag({ group, value: collection.value })
                              }
                            >
                              <Text style={styles.collectionSeeAll}>See all</Text>
                            </TouchableOpacity>
                          </View>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.collectionScroll}
                          >
                            {collection.items.map((collectionItem) => {
                              const colors = getCategoryColor(collectionItem.category);
                              return (
                                <View
                                  key={collectionItem.id}
                                  style={[styles.collectionCard, { borderColor: colors.border }]}
                                >
                                  <Text style={styles.collectionCardTitle}>{collectionItem.name}</Text>
                                  {collectionItem.location_name && (
                                    <Text style={styles.collectionCardSubtitle}>
                                      {collectionItem.location_name}
                                    </Text>
                                  )}
                                  {collectionItem.primary_tag && (
                                    <View style={styles.collectionCardBadge}>
                                      <Text style={styles.collectionCardBadgeText}>
                                        {formatTagValue(collectionItem.primary_tag)}
                                      </Text>
                                    </View>
                                  )}
                                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                    <TouchableOpacity
                                      style={[styles.chunkyButton, styles.mapButton]}
                                      onPress={() => openItemInMaps(collectionItem)}
                                    >
                                      <Text style={styles.mapButtonText}>MAP</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={[styles.chunkyButton, styles.visitButton]}
                                      onPress={() => handleMarkAsVisited(collectionItem.id)}
                                    >
                                      <Text style={styles.visitButtonText}>VISITED</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              );
                            })}
                          </ScrollView>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Hub Items */}
            {items.length > 0 ? (
              <View style={styles.hubItemsContainer}>
                {items.map(renderHubItem)}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={styles.emptyText}>No saved ideas yet</Text>
                <Text style={styles.emptySubtext}>
                  Drop a link in the chat to get started!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Visited Log Tab Content */}
        {activeTab === 'visited' && (
          <View style={styles.tabContent}>
            <View style={styles.visitedHeader}>
              <Text style={styles.visitedHeaderTitle}>Places Tracked 🗺️</Text>
              <View style={[styles.chunkyButton, styles.visitedCountBadge]}>
                <Text style={styles.visitedCountText}>
                  {visitedCount} {visitedCount === 1 ? 'PLACE' : 'PLACES'}
                </Text>
              </View>
            </View>

            {/* Map Placeholder */}
            <View style={[styles.chunkyCard, styles.mapPlaceholder]}>
              <Text style={styles.mapPlaceholderText}>
                🗺️ Live Map View (Pin Drop)
              </Text>
            </View>

            {/* Share Button */}
            {visitedCount > 0 && (
              <TouchableOpacity 
                style={[styles.chunkyButton, styles.shareButton]}
                onPress={handleShareVisitedPlaces}
              >
                <Text style={styles.shareButtonText}>📤 SHARE MY JOURNEY</Text>
              </TouchableOpacity>
            )}

            {/* Visited Items Timeline */}
            {items.length > 0 ? (
              <View style={styles.visitedItemsContainer}>
                <Text style={styles.timelineDate}>
                  {format(new Date(items[0].updated_at), 'EEEE, MMM dd').toUpperCase()}
                </Text>
                {items.map(renderVisitedItem)}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📸</Text>
                <Text style={styles.emptyText}>This log is empty</Text>
                <Text style={styles.emptySubtext}>
                  Go explore, then come back and mark it as visited! 🤳
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Leave Button */}
        <TouchableOpacity 
          style={[styles.chunkyButton, styles.leaveButton]} 
          onPress={handleLeave}
        >
          <Text style={styles.leaveButtonText}>Leave Trip</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* CHUNKY BOTTOM CHAT BAR */}
      <TouchableOpacity 
        style={styles.bottomChatBar}
        onPress={openChat}
        activeOpacity={0.8}
      >
        <View style={styles.chatBarContent}>
          <Text style={styles.chatBarEmoji}>💬</Text>
          <Text style={styles.chatBarTitle}>Chat with Agent</Text>
          <Text style={styles.chatBarArrow}>→</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBEB', // Cream background
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 90, // Reserve space for the bottom chat bar (increased for safety)
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  
  // CHUNKY BANNER
  bannerContainer: {
    height: 120,
    position: 'relative',
    borderBottomWidth: 4,
    borderBottomColor: '#000',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  bannerTripName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3B82F6', // Electric Blue (classy!)
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  bannerInputContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 4,
    borderBottomColor: '#000',
    alignItems: 'center',
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 16,
    color: '#000',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    marginBottom: 12,
  },
  uploadText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  cancelButton: {
    backgroundColor: '#E5E7EB',
  },
  cancelButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
  },

  // TRIP SQUAD
  tripSquadSection: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  tripSquadLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  squadAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#000',
  },
  squadAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  squadMore: {
    backgroundColor: '#1E40AF', // Deep Blue
  },

  // CHUNKY TABS
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 8,
    gap: 8,
    borderBottomWidth: 4,
    borderBottomColor: '#000',
  },
  chunkyTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  chunkyTabActive: {
    backgroundColor: '#3B82F6', // Electric Blue
    shadowOffset: { width: 3, height: 3 },
  },
  tabText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
  },
  tabTextActive: {
    color: '#fff',
  },

  // Tab Content
  tabContent: {
    backgroundColor: '#fff',
    paddingTop: 16,
  },
  filterVibesTitle: {
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 16,
    marginBottom: 12,
    color: '#000',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  categoryPill: {
    backgroundColor: '#E5E7EB',
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: '#1E40AF', // Deep Blue (classy!)
  },
  categoryPillText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
  },
  categoryPillTextActive: {
    color: '#fff',
  },

  smartLoading: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  smartLoadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  smartCollectionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  smartCollectionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  smartCollectionsTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  clearTagButton: {
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    shadowOpacity: 0,
    borderColor: '#1E3A8A',
  },
  clearTagButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  tagChipRow: {
    flexGrow: 0,
  },
  tagChip: {
    backgroundColor: '#E5E7EB',
    borderColor: '#111827',
    marginRight: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  tagChipActive: {
    backgroundColor: '#1E3A8A',
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  tagChipTextActive: {
    color: '#fff',
  },
  collectionList: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  collectionSection: {
    marginBottom: 16,
  },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  collectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  collectionSeeAll: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  collectionScroll: {
    flexGrow: 0,
  },
  collectionCard: {
    width: 160,
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  collectionCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 6,
  },
  collectionCardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  collectionCardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  collectionCardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3730A3',
  },

  // CHUNKY BUTTON BASE
  chunkyButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },

  // CHUNKY CARDS
  chunkyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 4,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  hubItemsContainer: {
    paddingTop: 8,
  },
  hubCardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  hubCardTitleContainer: {
    flex: 1,
  },
  hubCardTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
    color: '#000',
  },
  hubCardLocation: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  itemTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 8,
  },
  itemTagBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  itemTagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3730A3',
  },
  categoryBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginLeft: 12,
  },
  categoryBadgeEmoji: {
    fontSize: 24,
  },

  // AI VIBE CHECK
  vibeCheckContainer: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  vibeCheckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  vibeCheckLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E40AF', // Deep Blue instead of pink
  },
  sourceIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sourceIcon: {
    fontSize: 16,
  },
  vibeCheckText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  vibeCheckSource: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },

  // Action Buttons
  hubCardActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  mapButton: {
    flex: 1,
    backgroundColor: '#FDE047', // Yellow
    alignItems: 'center',
  },
  mapButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },
  visitButton: {
    flex: 1,
    backgroundColor: '#22C55E', // Green
    alignItems: 'center',
  },
  visitButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
  },

  // Visited Log
  visitedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  visitedHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  visitedCountBadge: {
    backgroundColor: '#22C55E',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  visitedCountText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
  },

  // Map Placeholder
  mapPlaceholder: {
    height: 180,
    backgroundColor: '#86EFAC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  mapPlaceholderText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
  },

  // Visited Items
  visitedItemsContainer: {
    paddingHorizontal: 16,
  },
  timelineDate: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#000',
    color: '#000',
  },
  visitedCard: {
    padding: 12,
  },
  visitedCardContent: {
    flexDirection: 'row',
    gap: 12,
  },
  visitedIconTime: {
    alignItems: 'center',
    width: 56,
  },
  visitedEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  visitedTime: {
    fontSize: 12,
    fontWeight: '900',
    color: '#22C55E',
  },
  visitedPeriod: {
    fontSize: 10,
  },
  visitedInfo: {
    flex: 1,
  },
  visitedTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  visitedTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    flex: 1,
  },
  visitedSourceButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  visitedSourceIcon: {
    fontSize: 14,
  },
  visitedLocation: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF', // Deep Blue for classy look
    marginBottom: 8,
  },
  visitedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
  },
  visitedBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
    color: '#000',
  },
  emptySubtext: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },

  // Share Button
  shareButton: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: '#22C55E', // Green for share action
    alignItems: 'center',
    paddingVertical: 14,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },

  // Leave Button
  leaveButton: {
    margin: 16,
    marginTop: 24,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderColor: '#EF4444',
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '900',
  },

  // CHUNKY BOTTOM CHAT BAR
  bottomChatBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 4,
    borderTopColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
    zIndex: 100,
  },
  chatBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatBarEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  chatBarTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    flex: 1,
  },
  chatBarArrow: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '900',
  },
});




