import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { TripMember } from '../types';

interface MemberListModalProps {
  visible: boolean;
  onClose: () => void;
  members: TripMember[];
  onlineUserIds?: string[];
  tripName?: string;
}

export default function MemberListModal({
  visible,
  onClose,
  members,
  onlineUserIds = [],
  tripName,
}: MemberListModalProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const isOnline = (memberId: string) => onlineUserIds.includes(memberId);

  const getAvatarColor = (name: string) => {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const onlineCount = members.filter((m) => isOnline(m.id)).length;

  const renderMember = ({ item }: { item: TripMember }) => {
    const online = isOnline(item.id);

    return (
      <View style={styles.memberRow}>
        <View style={styles.avatarContainer}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.name) }]}>
              <Text style={styles.initials}>{getInitials(item.name)}</Text>
            </View>
          )}
          {online && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.memberInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.memberName}>{item.name}</Text>
            {item.role === 'owner' && (
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerBadgeText}>Organizer</Text>
              </View>
            )}
          </View>
          <Text style={styles.memberEmail}>{item.email}</Text>
        </View>

        <View style={[styles.statusBadge, online ? styles.onlineBadge : styles.offlineBadge]}>
          <View style={[styles.statusDot, online ? styles.onlineStatusDot : styles.offlineStatusDot]} />
          <Text style={[styles.statusText, online ? styles.onlineStatusText : styles.offlineStatusText]}>
            {online ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        
        <View style={styles.modalContainer}>
          <BlurView intensity={90} tint="light" style={styles.blurContainer}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Trip Members</Text>
                <Text style={styles.headerSubtitle}>
                  {members.length} members · {onlineCount} online
                </Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Member List */}
            <FlatList
              data={members}
              renderItem={renderMember}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No members yet</Text>
                </View>
              }
            />

            {/* Invite Button */}
            <SafeAreaView edges={['bottom']}>
              <TouchableOpacity style={styles.inviteButton}>
                <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
                <Text style={styles.inviteButtonText}>Invite Friends</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContainer: {
    height: '70%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  memberEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  ownerBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  onlineBadge: {
    backgroundColor: '#F0FDF4',
  },
  offlineBadge: {
    backgroundColor: '#F8FAFC',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineStatusDot: {
    backgroundColor: '#22C55E',
  },
  offlineStatusDot: {
    backgroundColor: '#94A3B8',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  onlineStatusText: {
    color: '#22C55E',
  },
  offlineStatusText: {
    color: '#94A3B8',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 12,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

