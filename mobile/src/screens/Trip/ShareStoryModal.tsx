import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Share,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useCheckInStore } from '../../stores/checkInStore';
import { HapticFeedback } from '../../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ShareStoryModalProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  tripName: string;
  destination: string;
}

export const ShareStoryModal: React.FC<ShareStoryModalProps> = ({
  visible,
  onClose,
  tripId,
  tripName,
  destination,
}) => {
  const { currentStory, createOrGetStory, stats, fetchStats } = useCheckInStore();
  const [isCreating, setIsCreating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (visible && tripId) {
      fetchStats(tripId);
      loadOrCreateStory();
    }
  }, [visible, tripId]);

  const loadOrCreateStory = async () => {
    setIsCreating(true);
    try {
      await createOrGetStory(tripId, {
        isPublic: true,
        title: `My ${destination} Adventure`,
        showRatings: true,
        showPhotos: true,
        showNotes: true,
      });
    } catch (error) {
      console.error('Error creating story:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const shareStoryLink = async () => {
    if (!currentStory) return;

    HapticFeedback.medium();
    const storyUrl = `https://yorisan.com/story/${currentStory.share_code}`;
    const message = `Check out my ${destination} journey! 🗺️✨\n\n📍 ${stats?.unique_places || 0} places · ✅ ${stats?.total_checkins || 0} check-ins\n\nView my timeline: ${storyUrl}`;

    try {
      await Share.share({
        message,
        title: `My ${destination} Journey`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const copyLink = async () => {
    if (!currentStory) return;
    
    HapticFeedback.medium();
    const storyUrl = `https://yorisan.com/story/${currentStory.share_code}`;
    await Clipboard.setStringAsync(storyUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.overlayBg} />
      </TouchableOpacity>

      <View style={styles.modalContainer}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Share Timeline</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Stats Card */}
          {stats && (
            <View style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stats.unique_places || 0}</Text>
                  <Text style={styles.statLabel}>Places</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stats.total_checkins || 0}</Text>
                  <Text style={styles.statLabel}>Check-ins</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stats.days_active || 0}</Text>
                  <Text style={styles.statLabel}>Days</Text>
                </View>
              </View>
            </View>
          )}

          {/* Link Section */}
          {currentStory && (
            <View style={styles.linkSection}>
              <Text style={styles.linkLabel}>Your Story Link</Text>
              <View style={styles.linkContainer}>
                <Text style={styles.linkText} numberOfLines={1}>
                  yorisan.com/story/{currentStory.share_code}
                </Text>
                <TouchableOpacity 
                  style={[styles.copyButton, linkCopied && styles.copyButtonSuccess]}
                  onPress={copyLink}
                >
                  <Ionicons 
                    name={linkCopied ? "checkmark" : "copy-outline"} 
                    size={18} 
                    color={linkCopied ? "#10B981" : "#3B82F6"} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Share Button */}
          <TouchableOpacity
            style={styles.shareButton}
            onPress={shareStoryLink}
            disabled={!currentStory || isCreating}
          >
            <Ionicons name="share-social" size={20} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>
              {isCreating ? 'Creating...' : 'Share via...'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: SCREEN_WIDTH - 48,
    maxWidth: 400,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  linkSection: {
    marginBottom: 20,
  },
  linkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  copyButtonSuccess: {
    backgroundColor: '#ECFDF5',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
