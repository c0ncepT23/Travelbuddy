/**
 * Invite Modal - Shows invite code and share options
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Share,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { HapticFeedback } from '../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  tripName: string;
  destination: string;
  inviteCode: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  visible,
  onClose,
  tripName,
  destination,
  inviteCode,
}) => {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const inviteLink = `https://yorisan.com/join/${inviteCode}`;
  
  const shareMessage = `Join my trip "${tripName}" to ${destination}! 🌍✈️\n\n📱 Invite Code: ${inviteCode}\n\n🔗 Or tap: ${inviteLink}`;

  const handleCopyCode = async () => {
    HapticFeedback.medium();
    await Clipboard.setStringAsync(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    HapticFeedback.medium();
    await Clipboard.setStringAsync(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareLink = async () => {
    HapticFeedback.light();
    try {
      await Share.share({
        message: shareMessage,
        title: `Join ${tripName}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <BlurView intensity={20} style={styles.blurOverlay} />
      </TouchableOpacity>

      <View style={styles.modalContainer}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Invite Friends</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Trip Info */}
          <View style={styles.tripInfo}>
            <Text style={styles.tripName}>{tripName}</Text>
            <Text style={styles.tripDestination}>📍 {destination}</Text>
          </View>

          {/* Invite Code Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Invite Code</Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{inviteCode}</Text>
              <TouchableOpacity 
                style={[styles.copyButton, codeCopied && styles.copyButtonSuccess]}
                onPress={handleCopyCode}
              >
                <Ionicons 
                  name={codeCopied ? "checkmark" : "copy-outline"} 
                  size={20} 
                  color={codeCopied ? "#10B981" : "#3B82F6"} 
                />
                <Text style={[styles.copyButtonText, codeCopied && styles.copyButtonTextSuccess]}>
                  {codeCopied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Friends can enter this code to join your trip</Text>
          </View>

          {/* Invite Link Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Invite Link</Text>
            <View style={styles.linkContainer}>
              <Text style={styles.linkText} numberOfLines={1}>{inviteLink}</Text>
              <TouchableOpacity 
                style={[styles.copyButton, linkCopied && styles.copyButtonSuccess]}
                onPress={handleCopyLink}
              >
                <Ionicons 
                  name={linkCopied ? "checkmark" : "copy-outline"} 
                  size={20} 
                  color={linkCopied ? "#10B981" : "#3B82F6"} 
                />
                <Text style={[styles.copyButtonText, linkCopied && styles.copyButtonTextSuccess]}>
                  {linkCopied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Share Button */}
          <TouchableOpacity style={styles.shareButton} onPress={handleShareLink}>
            <Ionicons name="share-social" size={22} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Share via...</Text>
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
  blurOverlay: {
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  tripInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  tripName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  tripDestination: {
    fontSize: 14,
    color: '#64748B',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
  },
  codeText: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 4,
    textAlign: 'center',
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
    color: '#64748B',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  copyButtonSuccess: {
    backgroundColor: '#ECFDF5',
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 4,
  },
  copyButtonTextSuccess: {
    color: '#10B981',
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});

export default InviteModal;

