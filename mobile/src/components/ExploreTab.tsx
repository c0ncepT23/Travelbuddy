/**
 * ExploreTab - Discovery suggestions for a trip
 * 
 * Shows AI-suggested places from videos that mentioned food items
 * but not specific restaurant names. Users can:
 * - View on Google Maps (free, no enrichment)
 * - Save to their trip (triggers full Places API enrichment)
 * - Dismiss suggestions they're not interested in
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import api from '../config/api';

// Colors matching the app theme
const COLORS = {
  background: '#0A0A1A',
  surface: '#17191F',
  surfaceLight: '#1E2028',
  primary: '#06B6D4',
  primaryDark: '#0891B2',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  border: 'rgba(255, 255, 255, 0.1)',
};

interface DiscoveryItem {
  id: string;
  item: string;
  city: string;
  country?: string;
  vibe?: string;
  source_url?: string;
  source_title?: string;
  source_platform?: string;
  created_at: string;
}

interface GroupedDiscovery {
  source_url: string;
  source_title: string;
  source_platform: string;
  items: DiscoveryItem[];
}

interface ExploreTabProps {
  tripId: string;
  countryName: string;
  onSavePlace: (item: DiscoveryItem) => void;
}

export default function ExploreTab({ tripId, countryName, onSavePlace }: ExploreTabProps) {
  const [discoveries, setDiscoveries] = useState<DiscoveryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // Fetch discovery queue items for this trip
  const fetchDiscoveries = useCallback(async () => {
    try {
      const response = await api.get(`/share/discovery-queue/${tripId}`);
      if (response.data.success) {
        setDiscoveries(response.data.items || []);
      }
    } catch (error) {
      console.error('[ExploreTab] Error fetching discoveries:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchDiscoveries();
  }, [fetchDiscoveries]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDiscoveries();
  };

  // Open Google Maps search for a place
  const handleViewOnMaps = (item: DiscoveryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const query = encodeURIComponent(`${item.item} ${item.city}`);
    const url = `https://www.google.com/maps/search/${query}`;
    Linking.openURL(url);
  };

  // Open source video
  const handleOpenSource = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url);
  };

  // Save place (trigger enrichment)
  const handleSave = async (item: DiscoveryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSavingIds(prev => new Set([...prev, item.id]));
    
    try {
      // Call parent to handle the save + enrichment
      await onSavePlace(item);
      
      // Mark as saved in discovery queue
      await api.post(`/share/discovery-queue/${item.id}/saved`);
      
      // Remove from local list
      setDiscoveries(prev => prev.filter(d => d.id !== item.id));
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[ExploreTab] Error saving place:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // Dismiss a discovery item
  const handleDismiss = async (item: DiscoveryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      await api.post(`/share/discovery-queue/${item.id}/dismiss`);
      setDiscoveries(prev => prev.filter(d => d.id !== item.id));
    } catch (error) {
      console.error('[ExploreTab] Error dismissing:', error);
    }
  };

  // Group discoveries by source video
  const groupedDiscoveries = React.useMemo(() => {
    const groups: Map<string, GroupedDiscovery> = new Map();
    
    discoveries.forEach(item => {
      const key = item.source_url || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, {
          source_url: item.source_url || '',
          source_title: item.source_title || 'Unknown Video',
          source_platform: item.source_platform || 'video',
          items: [],
        });
      }
      groups.get(key)!.items.push(item);
    });
    
    return Array.from(groups.values());
  }, [discoveries]);

  // Get platform icon
  const getPlatformIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'youtube':
        return 'logo-youtube';
      case 'instagram':
        return 'logo-instagram';
      case 'tiktok':
        return 'logo-tiktok';
      default:
        return 'videocam';
    }
  };

  // Render a single discovery item
  const renderDiscoveryItem = (item: DiscoveryItem) => {
    const isSaving = savingIds.has(item.id);
    
    return (
      <MotiView
        key={item.id}
        from={{ opacity: 0, translateX: -20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 300 }}
        style={styles.discoveryCard}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.itemEmoji}>🍜</Text>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.item}</Text>
              <Text style={styles.itemCity}>{item.city}</Text>
            </View>
          </View>
          
          {item.vibe && (
            <Text style={styles.vibeText}>"{item.vibe}"</Text>
          )}
          
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleViewOnMaps(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="map-outline" size={18} color={COLORS.primary} />
              <Text style={styles.actionText}>View</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={() => handleSave(item)}
              disabled={isSaving}
              activeOpacity={0.7}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="bookmark-outline" size={18} color="#FFFFFF" />
                  <Text style={[styles.actionText, styles.saveText]}>Save</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => handleDismiss(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </MotiView>
    );
  };

  // Render a video group with its items
  const renderVideoGroup = ({ item: group, index }: { item: GroupedDiscovery; index: number }) => (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 400, delay: index * 100 }}
      style={styles.videoGroup}
    >
      {/* Video source header */}
      <TouchableOpacity
        style={styles.sourceHeader}
        onPress={() => group.source_url && handleOpenSource(group.source_url)}
        activeOpacity={group.source_url ? 0.7 : 1}
      >
        <Ionicons 
          name={getPlatformIcon(group.source_platform)} 
          size={20} 
          color={COLORS.primary} 
        />
        <View style={styles.sourceInfo}>
          <Text style={styles.sourceTitle} numberOfLines={1}>
            {group.source_title}
          </Text>
          {group.source_url && (
            <Text style={styles.sourceUrl} numberOfLines={1}>
              {group.source_url.replace(/^https?:\/\//, '').substring(0, 40)}...
            </Text>
          )}
        </View>
        {group.source_url && (
          <Ionicons name="open-outline" size={16} color={COLORS.textMuted} />
        )}
      </TouchableOpacity>
      
      {/* Discovery items from this video */}
      <View style={styles.itemsList}>
        {group.items.map(renderDiscoveryItem)}
      </View>
    </MotiView>
  );

  // Empty state
  if (!isLoading && discoveries.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No discoveries yet</Text>
            <Text style={styles.emptySubtitle}>
              Share videos about {countryName} food and{'\n'}
              we'll suggest famous spots for you!
            </Text>
          </MotiView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔍 Explore</Text>
        <Text style={styles.headerSubtitle}>
          AI suggestions from your videos
        </Text>
      </View>
      
      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={18} color={COLORS.primary} />
        <Text style={styles.infoText}>
          Tap "View" to research on Google Maps, then "Save" to add to your trip
        </Text>
      </View>
      
      {/* Discovery list */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Finding suggestions...</Text>
        </View>
      ) : (
        <FlatList
          data={groupedDiscoveries}
          renderItem={renderVideoGroup}
          keyExtractor={(item) => item.source_url || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMuted,
    marginLeft: 10,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  videoGroup: {
    marginBottom: 24,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sourceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  sourceUrl: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  itemsList: {
    gap: 10,
  },
  discoveryCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemEmoji: {
    fontSize: 32,
  },
  itemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  itemCity: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  vibeText: {
    fontSize: 13,
    color: COLORS.primary,
    fontStyle: 'italic',
    marginBottom: 12,
    paddingLeft: 44,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 6,
  },
  saveText: {
    color: '#FFFFFF',
  },
  dismissButton: {
    marginLeft: 'auto',
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

