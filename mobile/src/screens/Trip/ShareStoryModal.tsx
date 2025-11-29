import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  ScrollView,
  Alert,
  Share,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useCheckInStore } from '../../stores/checkInStore';

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
  const { currentStory, createOrGetStory, updateStory, stats, fetchStats } = useCheckInStore();
  const [isPublic, setIsPublic] = useState(true);
  const [showRatings, setShowRatings] = useState(true);
  const [showPhotos, setShowPhotos] = useState(true);
  const [showCosts, setShowCosts] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [storyTitle, setStoryTitle] = useState(`My ${destination} Adventure`);
  const [storyDescription, setStoryDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (visible && tripId) {
      fetchStats(tripId);
      loadOrCreateStory();
    }
  }, [visible, tripId]);

  const loadOrCreateStory = async () => {
    setIsCreating(true);
    try {
      const story = await createOrGetStory(tripId, {
        isPublic,
        title: storyTitle,
        description: storyDescription,
        showRatings,
        showPhotos,
        showCosts,
        showNotes,
      });
      
      if (story) {
        setStoryTitle(story.title || `My ${destination} Adventure`);
        setStoryDescription(story.description || '');
        setIsPublic(story.is_public);
        setShowRatings(story.show_ratings);
        setShowPhotos(story.show_photos);
        setShowCosts(story.show_costs);
        setShowNotes(story.show_notes);
      }
    } catch (error) {
      console.error('Error creating story:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateSettings = async () => {
    if (!currentStory) return;
    
    try {
      await updateStory(currentStory.share_code, {
        isPublic,
        title: storyTitle,
        description: storyDescription,
        showRatings,
        showPhotos,
        showCosts,
        showNotes,
      });
      Alert.alert('✅ Updated', 'Your story settings have been updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update story settings');
    }
  };

  const shareStoryLink = async () => {
    if (!currentStory) {
      Alert.alert('Creating story...', 'Please wait a moment');
      return;
    }

    const storyUrl = `https://travelagent.app/story/${currentStory.share_code}`;
    const message = `Check out my ${destination} journey! 🗾\n\n${storyTitle}\n\n${
      stats ? `📍 ${stats.unique_places || 0} places visited\n⭐ ${stats.total_checkins || 0} check-ins\n\n` : ''
    }View my timeline: ${storyUrl}`;

    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(storyUrl);
        Alert.alert('Copied!', 'Story link copied to clipboard');
      } else {
        await Share.share({
          message,
          title: storyTitle,
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const copyLink = async () => {
    if (!currentStory) return;
    
    const storyUrl = `https://travelagent.app/story/${currentStory.share_code}`;
    await Clipboard.setStringAsync(storyUrl);
    Alert.alert('Copied!', 'Story link copied to clipboard');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Share Your Journey 🗺️</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Story Stats */}
            {stats && (
              <View style={styles.statsCard}>
                <Text style={styles.statsTitle}>Your Journey So Far</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{stats.unique_places || 0}</Text>
                    <Text style={styles.statLabel}>Places</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{stats.total_checkins || 0}</Text>
                    <Text style={styles.statLabel}>Check-ins</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{stats.days_active || 0}</Text>
                    <Text style={styles.statLabel}>Days</Text>
                  </View>
                  {typeof stats.avg_rating === 'number' && stats.avg_rating > 0 && (
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>{Number(stats.avg_rating).toFixed(1)}⭐</Text>
                      <Text style={styles.statLabel}>Avg Rating</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Story Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Story Details</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Story Title"
                value={storyTitle}
                onChangeText={setStoryTitle}
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add a description (optional)"
                value={storyDescription}
                onChangeText={setStoryDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Privacy Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Privacy Settings</Text>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Make story public</Text>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                  thumbColor={isPublic ? '#FFFFFF' : '#F3F4F6'}
                />
              </View>

              <Text style={styles.helperText}>
                {isPublic 
                  ? '✅ Anyone with the link can view your journey' 
                  : '🔒 Only you can view this story'}
              </Text>
            </View>

            {/* Content Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What to Include</Text>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Show ratings</Text>
                <Switch
                  value={showRatings}
                  onValueChange={setShowRatings}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                />
              </View>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Show photos</Text>
                <Switch
                  value={showPhotos}
                  onValueChange={setShowPhotos}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                />
              </View>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Show notes</Text>
                <Switch
                  value={showNotes}
                  onValueChange={setShowNotes}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                />
              </View>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Show costs</Text>
                <Switch
                  value={showCosts}
                  onValueChange={setShowCosts}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                />
              </View>
            </View>

            {/* Share Link */}
            {currentStory && (
              <View style={styles.linkSection}>
                <Text style={styles.linkLabel}>Your Story Link</Text>
                <View style={styles.linkContainer}>
                  <Text style={styles.linkText} numberOfLines={1}>
                    travelagent.app/story/{currentStory.share_code}
                  </Text>
                  <TouchableOpacity style={styles.copyButton} onPress={copyLink}>
                    <Text style={styles.copyButtonText}>📋</Text>
                  </TouchableOpacity>
                </View>
                
                {currentStory.views_count > 0 && (
                  <Text style={styles.viewCount}>
                    👁️ Viewed {currentStory.views_count} times
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleUpdateSettings}
            >
              <Text style={styles.updateButtonText}>Update Settings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.shareButton}
              onPress={shareStoryLink}
              disabled={!currentStory || isCreating}
            >
              <Text style={styles.shareButtonText}>
                {isCreating ? 'Creating...' : 'Share Journey 🚀'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    fontSize: 28,
    color: '#6B7280',
    fontWeight: '300',
  },
  content: {
    padding: 20,
  },
  statsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 14,
    color: '#374151',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  linkSection: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  linkLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: '#6366F1',
  },
  copyButton: {
    padding: 4,
  },
  copyButtonText: {
    fontSize: 20,
  },
  viewCount: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  updateButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
