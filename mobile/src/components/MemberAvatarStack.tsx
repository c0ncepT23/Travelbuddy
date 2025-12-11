import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { TripMember } from '../types';

interface MemberAvatarStackProps {
  members: TripMember[];
  onlineUserIds?: string[];
  maxDisplay?: number;
  onPress?: () => void;
}

export default function MemberAvatarStack({
  members,
  onlineUserIds = [],
  maxDisplay = 4,
  onPress,
}: MemberAvatarStackProps) {
  const displayMembers = members.slice(0, maxDisplay);
  const remainingCount = Math.max(0, members.length - maxDisplay);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const isOnline = (memberId: string) => onlineUserIds.includes(memberId);

  // Generate consistent color based on name
  const getAvatarColor = (name: string) => {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarStack}>
        {displayMembers.map((member, index) => (
          <View
            key={member.id}
            style={[
              styles.avatarWrapper,
              { marginLeft: index === 0 ? 0 : -10, zIndex: displayMembers.length - index },
            ]}
          >
            {member.avatar_url ? (
              <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: getAvatarColor(member.name) }]}>
                <Text style={styles.initials}>{getInitials(member.name)}</Text>
              </View>
            )}
            {isOnline(member.id) && <View style={styles.onlineDot} />}
          </View>
        ))}
        
        {remainingCount > 0 && (
          <View style={[styles.avatarWrapper, { marginLeft: -10, zIndex: 0 }]}>
            <View style={[styles.avatar, styles.remainingAvatar]}>
              <Text style={styles.remainingText}>+{remainingCount}</Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  initials: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  remainingAvatar: {
    backgroundColor: '#E2E8F0',
  },
  remainingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
});

