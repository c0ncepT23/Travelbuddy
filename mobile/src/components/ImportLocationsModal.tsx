import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ItemCategory, PendingImportPlace } from '../types';
import { useChatStore } from '../stores/chatStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImportLocationsModalProps {
  visible: boolean;
  onClose: () => void;
  sourceUrl: string;
  sourceType: 'youtube' | 'reddit' | 'instagram';
  sourceTitle: string;
  summary?: string;
  places: PendingImportPlace[];
  tripId: string;
  onImportComplete: (count: number) => void;
}

const CATEGORY_EMOJIS: Record<ItemCategory, string> = {
  [ItemCategory.FOOD]: '🍽️',
  [ItemCategory.ACCOMMODATION]: '🏨',
  [ItemCategory.PLACE]: '📍',
  [ItemCategory.SHOPPING]: '🛍️',
  [ItemCategory.ACTIVITY]: '🎯',
  [ItemCategory.TIP]: '💡',
};

const SOURCE_EMOJIS = {
  youtube: '▶️',
  reddit: '💬',
  instagram: '📷',
};

export default function ImportLocationsModal({
  visible,
  onClose,
  sourceUrl,
  sourceType,
  sourceTitle,
  summary,
  places,
  tripId,
  onImportComplete,
}: ImportLocationsModalProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const slideAnim = useState(new Animated.Value(SCREEN_HEIGHT))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];
  const { importLocations } = useChatStore();

  // Initialize with all places selected
  useEffect(() => {
    if (visible && places.length > 0) {
      setSelectedIndices(new Set(places.map((_, index) => index)));
      // Animate in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!visible) {
      // Reset animation values
      slideAnim.setValue(SCREEN_HEIGHT);
      fadeAnim.setValue(0);
    }
  }, [visible, places]);

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === places.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(places.map((_, index) => index)));
    }
  };

  const handleImport = async () => {
    if (selectedIndices.size === 0) {
      Alert.alert('No Selection', 'Please select at least one location to import.');
      return;
    }

    setIsImporting(true);
    try {
      const selectedPlaces = Array.from(selectedIndices).map((index) => places[index]);

      const savedCount = await importLocations(tripId, {
        sourceUrl,
        sourceType,
        sourceTitle,
        selectedPlaces,
      });

      // Animate out
      await new Promise((resolve) => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(resolve);
      });

      onImportComplete(savedCount);
      onClose();
    } catch (error: any) {
      Alert.alert('Import Failed', error.message || 'Failed to import locations');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      {/* Overlay */}
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={handleClose} />
      </Animated.View>

      {/* Modal Content */}
      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.dragHandle} />
          <View style={styles.headerContent}>
            <Text style={styles.title}>Import Locations</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Select the spots you want to save</Text>

          {/* Source Card */}
          <View style={styles.sourceCard}>
            <Text style={styles.sourceEmoji}>{SOURCE_EMOJIS[sourceType]}</Text>
            <View style={styles.sourceInfo}>
              <Text style={styles.sourceLabel}>
                {sourceType.charAt(0).toUpperCase() + sourceType.slice(1)}
              </Text>
              <Text style={styles.sourceTitle} numberOfLines={2}>
                {sourceTitle}
              </Text>
            </View>
          </View>
        </View>

        {/* Locations List */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {places.map((place, index) => {
            const isSelected = selectedIndices.has(index);
            return (
              <TouchableOpacity
                key={index}
                style={[styles.locationCard, isSelected && styles.locationCardSelected]}
                onPress={() => toggleSelection(index)}
                activeOpacity={0.7}
              >
                <View style={styles.locationContent}>
                  {/* Category Emoji */}
                  <Text style={styles.categoryEmoji}>{CATEGORY_EMOJIS[place.category]}</Text>

                  {/* Location Info */}
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>{place.name}</Text>
                    <Text style={styles.locationDescription} numberOfLines={2}>
                      {place.description}
                    </Text>
                    {place.location_name && (
                      <Text style={styles.locationPlace}>{place.location_name}</Text>
                    )}
                  </View>

                  {/* Checkbox */}
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.selectAllButton} onPress={toggleSelectAll}>
            <Text style={styles.selectAllText}>
              {selectedIndices.size === places.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.importButton,
              (selectedIndices.size === 0 || isImporting) && styles.importButtonDisabled,
            ]}
            onPress={handleImport}
            disabled={selectedIndices.size === 0 || isImporting}
          >
            {isImporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.importButtonText}>
                Save {selectedIndices.size} {selectedIndices.size === 1 ? 'spot' : 'spots'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.85,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#8E8E93',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  sourceEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  locationCard: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  locationCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  categoryEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
    marginRight: 12,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  locationDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  locationPlace: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#fff',
  },
  selectAllButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  selectAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  importButton: {
    flex: 1,
    marginLeft: 12,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  importButtonDisabled: {
    backgroundColor: '#E5E5EA',
    shadowOpacity: 0,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

