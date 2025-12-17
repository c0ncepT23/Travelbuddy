import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated as RNAnimated,
} from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { SavedItem, SubClusters, SubCluster } from '../types';
import { HapticFeedback } from '../utils/haptics';

const { width: screenWidth } = Dimensions.get('window');

// Zenly-inspired color palettes for different cluster types
const CUISINE_COLORS: Record<string, { bg: string[]; accent: string; emoji: string }> = {
  ramen: { bg: ['#FF6B6B', '#FF8E53'], accent: '#FFE66D', emoji: '🍜' },
  sushi: { bg: ['#4ECDC4', '#45B7AA'], accent: '#96F2D7', emoji: '🍣' },
  wagyu: { bg: ['#E74C3C', '#C0392B'], accent: '#F5B7B1', emoji: '🥩' },
  izakaya: { bg: ['#F39C12', '#E67E22'], accent: '#FDEAA8', emoji: '🍶' },
  cheesecake: { bg: ['#E91E63', '#C2185B'], accent: '#F8BBD9', emoji: '🍰' },
  matcha: { bg: ['#27AE60', '#1E8449'], accent: '#ABEBC6', emoji: '🍵' },
  tempura: { bg: ['#F1C40F', '#D4AC0D'], accent: '#FCF3CF', emoji: '🍤' },
  udon: { bg: ['#95A5A6', '#7F8C8D'], accent: '#D5DBDB', emoji: '🍲' },
  curry: { bg: ['#E67E22', '#D35400'], accent: '#FAD7A0', emoji: '🍛' },
  coffee: { bg: ['#795548', '#5D4037'], accent: '#D7CCC8', emoji: '☕' },
  dessert: { bg: ['#FF69B4', '#FF1493'], accent: '#FFB6C1', emoji: '🍨' },
  bbq: { bg: ['#D84315', '#BF360C'], accent: '#FFAB91', emoji: '🔥' },
  seafood: { bg: ['#0277BD', '#01579B'], accent: '#81D4FA', emoji: '🦐' },
  default: { bg: ['#667eea', '#764ba2'], accent: '#C9B1FF', emoji: '🍽️' },
};

const PLACE_COLORS: Record<string, { bg: string[]; accent: string; emoji: string }> = {
  temple: { bg: ['#8E24AA', '#6A1B9A'], accent: '#E1BEE7', emoji: '⛩️' },
  shrine: { bg: ['#D32F2F', '#B71C1C'], accent: '#FFCDD2', emoji: '🏯' },
  castle: { bg: ['#5D4037', '#4E342E'], accent: '#BCAAA4', emoji: '🏰' },
  garden: { bg: ['#388E3C', '#2E7D32'], accent: '#A5D6A7', emoji: '🌸' },
  market: { bg: ['#F57C00', '#E65100'], accent: '#FFCC80', emoji: '🏪' },
  viewpoint: { bg: ['#1976D2', '#1565C0'], accent: '#90CAF9', emoji: '🌅' },
  museum: { bg: ['#455A64', '#37474F'], accent: '#B0BEC5', emoji: '🏛️' },
  park: { bg: ['#43A047', '#388E3C'], accent: '#C8E6C9', emoji: '🌳' },
  beach: { bg: ['#00BCD4', '#0097A7'], accent: '#80DEEA', emoji: '🏖️' },
  mountain: { bg: ['#546E7A', '#455A64'], accent: '#B0BEC5', emoji: '⛰️' },
  onsen: { bg: ['#FF7043', '#F4511E'], accent: '#FFCCBC', emoji: '♨️' },
  tower: { bg: ['#5C6BC0', '#3F51B5'], accent: '#C5CAE9', emoji: '🗼' },
  street: { bg: ['#78909C', '#607D8B'], accent: '#CFD8DC', emoji: '🚶' },
  default: { bg: ['#667eea', '#764ba2'], accent: '#C9B1FF', emoji: '📍' },
};

interface SubClusterBrowserProps {
  subClusters: SubClusters;
  items: SavedItem[];
  onClusterSelect: (clusterType: string, items: SavedItem[], isCuisine: boolean) => void;
  onClose: () => void;
}

export const SubClusterBrowser: React.FC<SubClusterBrowserProps> = ({
  subClusters,
  items,
  onClusterSelect,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'food' | 'places'>('food');
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);

  const getColorScheme = (type: string, isCuisine: boolean) => {
    const colors = isCuisine ? CUISINE_COLORS : PLACE_COLORS;
    const key = type.toLowerCase().replace(/\s+/g, '');
    return colors[key] || colors.default;
  };

  const handleClusterPress = (cluster: SubCluster, isCuisine: boolean) => {
    HapticFeedback.medium();
    setSelectedCluster(cluster.type);
    
    // Find matching items
    const matchingItems = items.filter(item => {
      if (isCuisine) {
        return item.cuisine_type?.toLowerCase() === cluster.type.toLowerCase() ||
               item.primary_tag?.toLowerCase() === cluster.type.toLowerCase();
      } else {
        return item.place_type?.toLowerCase() === cluster.type.toLowerCase() ||
               item.primary_tag?.toLowerCase() === cluster.type.toLowerCase();
      }
    });
    
    setTimeout(() => {
      onClusterSelect(cluster.type, matchingItems, isCuisine);
    }, 200);
  };

  const renderClusterCard = (cluster: SubCluster, index: number, isCuisine: boolean) => {
    const colors = getColorScheme(cluster.type, isCuisine);
    const isSelected = selectedCluster === cluster.type;
    
    return (
      <MotiView
        key={`${isCuisine ? 'cuisine' : 'place'}-${cluster.type}`}
        from={{ opacity: 0, scale: 0.8, translateY: 20 }}
        animate={{ 
          opacity: 1, 
          scale: isSelected ? 0.95 : 1, 
          translateY: 0 
        }}
        transition={{ 
          type: 'spring', 
          delay: index * 80,
          damping: 15,
        }}
      >
        <TouchableOpacity
          onPress={() => handleClusterPress(cluster, isCuisine)}
          activeOpacity={0.85}
          style={styles.clusterCardWrapper}
        >
          <LinearGradient
            colors={colors.bg}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.clusterCard}
          >
            {/* Decorative blob */}
            <View style={[styles.decorativeBlob, { backgroundColor: colors.accent }]} />
            
            {/* Content */}
            <View style={styles.clusterContent}>
              <Text style={styles.clusterEmoji}>{colors.emoji}</Text>
              <View style={styles.clusterTextContainer}>
                <Text style={styles.clusterCount}>{cluster.count}</Text>
                <Text style={styles.clusterType}>{cluster.type}</Text>
              </View>
            </View>
            
            {/* Tap indicator */}
            <View style={styles.tapIndicator}>
              <Text style={styles.tapIndicatorText}>→</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </MotiView>
    );
  };

  const cuisineClusters = subClusters.cuisine_types || [];
  const placeClusters = subClusters.place_types || [];

  return (
    <MotiView
      from={{ opacity: 0, translateY: 100 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: 100 }}
      transition={{ type: 'spring', damping: 20 }}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.handleBar} />
        </View>
        
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>What are you craving? ✨</Text>
            <Text style={styles.subtitle}>Browse by type, find exactly what you saved</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        {/* Tab Switcher - Zenly style pill */}
        <View style={styles.tabContainer}>
          <View style={styles.tabBackground}>
            <MotiView
              animate={{
                translateX: activeTab === 'food' ? 0 : screenWidth * 0.43,
              }}
              transition={{ type: 'spring', damping: 20 }}
              style={styles.tabIndicator}
            />
            <TouchableOpacity
              style={styles.tab}
              onPress={() => {
                HapticFeedback.light();
                setActiveTab('food');
                setSelectedCluster(null);
              }}
            >
              <Text style={[styles.tabText, activeTab === 'food' && styles.tabTextActive]}>
                🍽️ Food ({cuisineClusters.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => {
                HapticFeedback.light();
                setActiveTab('places');
                setSelectedCluster(null);
              }}
            >
              <Text style={[styles.tabText, activeTab === 'places' && styles.tabTextActive]}>
                📍 Places ({placeClusters.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Cluster Grid */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      >
        <AnimatePresence>
          {activeTab === 'food' ? (
            cuisineClusters.length > 0 ? (
              <View style={styles.grid}>
                {cuisineClusters.map((cluster, index) => 
                  renderClusterCard(cluster, index, true)
                )}
              </View>
            ) : (
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={styles.emptyState}
              >
                <Text style={styles.emptyEmoji}>🍽️</Text>
                <Text style={styles.emptyText}>No food types detected yet</Text>
                <Text style={styles.emptySubtext}>
                  Add more places and our AI will categorize them!
                </Text>
              </MotiView>
            )
          ) : (
            placeClusters.length > 0 ? (
              <View style={styles.grid}>
                {placeClusters.map((cluster, index) => 
                  renderClusterCard(cluster, index, false)
                )}
              </View>
            ) : (
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={styles.emptyState}
              >
                <Text style={styles.emptyEmoji}>📍</Text>
                <Text style={styles.emptyText}>No place types detected yet</Text>
                <Text style={styles.emptySubtext}>
                  Save some temples, shrines, or markets!
                </Text>
              </MotiView>
            )
          )}
        </AnimatePresence>
        
        {/* Fun tip at bottom */}
        <View style={styles.tipContainer}>
          <Text style={styles.tipText}>
            💡 Tip: AI automatically categorizes your saved spots
          </Text>
        </View>
      </ScrollView>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '75%',
    backgroundColor: '#FAFBFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 25,
  },
  header: {
    paddingTop: 8,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTop: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  handleBar: {
    width: 40,
    height: 5,
    backgroundColor: '#DDE1E6',
    borderRadius: 3,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
  },
  
  // Tab Switcher - Zenly style
  tabContainer: {
    paddingBottom: 16,
  },
  tabBackground: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: '48%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    zIndex: 1,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#1A1A2E',
  },
  
  // Grid
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  
  // Cluster Card
  clusterCardWrapper: {
    width: (screenWidth - 44) / 2,
    marginBottom: 4,
  },
  clusterCard: {
    borderRadius: 20,
    padding: 16,
    minHeight: 110,
    overflow: 'hidden',
    position: 'relative',
  },
  decorativeBlob: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.3,
  },
  clusterContent: {
    flex: 1,
  },
  clusterEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  clusterTextContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  clusterCount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  clusterType: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'capitalize',
  },
  tapIndicator: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapIndicatorText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
    opacity: 0.7,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  
  // Tip
  tipContainer: {
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  tipText: {
    fontSize: 14,
    color: '#166534',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default SubClusterBrowser;

