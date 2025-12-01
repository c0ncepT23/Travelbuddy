import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import theme from '../config/theme';
import { HapticFeedback } from '../utils/haptics';

interface QuickActionChipsProps {
  suggestions: string[];
  onChipPress: (suggestion: string) => void;
  style?: any;
}

/**
 * QuickActionChips - Time-appropriate action suggestions
 * Displays tappable chips like [🍜 Food] [🏯 Culture] [🛍️ Shopping]
 */
export function QuickActionChips({ suggestions, onChipPress, style }: QuickActionChipsProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  const handlePress = (suggestion: string) => {
    HapticFeedback.light();
    onChipPress(suggestion);
  };

  return (
    <View style={[styles.container, style]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {suggestions.map((suggestion, index) => (
          <MotiView
            key={suggestion}
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ 
              type: 'spring', 
              delay: index * 50,
              damping: 15,
            }}
          >
            <TouchableOpacity
              style={styles.chip}
              onPress={() => handlePress(suggestion)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipText}>{suggestion}</Text>
            </TouchableOpacity>
          </MotiView>
        ))}
      </ScrollView>
    </View>
  );
}

// Category-based quick actions
interface CategoryChipsProps {
  categories: Record<string, number>;
  onCategoryPress: (category: string) => void;
  selectedCategory?: string | null;
  style?: any;
}

const categoryConfig: Record<string, { emoji: string; label: string; color: string }> = {
  food: { emoji: '🍽️', label: 'Food', color: theme.colors.food },
  place: { emoji: '📍', label: 'Places', color: theme.colors.place },
  shopping: { emoji: '🛍️', label: 'Shopping', color: theme.colors.shopping },
  activity: { emoji: '🎯', label: 'Activities', color: theme.colors.activity },
  accommodation: { emoji: '🏨', label: 'Hotels', color: theme.colors.accommodation },
  tip: { emoji: '💡', label: 'Tips', color: theme.colors.tip },
};

export function CategoryChips({ categories, onCategoryPress, selectedCategory, style }: CategoryChipsProps) {
  const availableCategories = Object.entries(categories)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]); // Sort by count descending

  if (availableCategories.length === 0) {
    return null;
  }

  const handlePress = (category: string) => {
    HapticFeedback.light();
    onCategoryPress(category);
  };

  return (
    <View style={[styles.container, style]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {availableCategories.map(([category, count], index) => {
          const config = categoryConfig[category] || { 
            emoji: '✨', 
            label: category, 
            color: theme.colors.primary 
          };
          const isSelected = selectedCategory === category;
          
          return (
            <MotiView
              key={category}
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                type: 'spring', 
                delay: index * 50,
                damping: 15,
              }}
            >
              <TouchableOpacity
                style={[
                  styles.categoryChip, 
                  { borderColor: config.color },
                  isSelected && { backgroundColor: config.color }
                ]}
                onPress={() => handlePress(category)}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryEmoji}>{config.emoji}</Text>
                <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>{config.label}</Text>
                <View style={[styles.categoryBadge, { backgroundColor: isSelected ? theme.colors.surface : config.color }]}>
                  <Text style={[styles.categoryCount, isSelected && { color: config.color }]}>{count}</Text>
                </View>
              </TouchableOpacity>
            </MotiView>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Preset quick prompts
interface QuickPromptsProps {
  onPromptPress: (prompt: string) => void;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  isNewTrip?: boolean; // Show welcome prompts for new trips
  style?: any;
}

const timeBasedPrompts: Record<string, string[]> = {
  morning: [
    '🎲 Surprise me!',
    '☕ Breakfast nearby?',
    '📋 Plan my day',
  ],
  afternoon: [
    '🎲 Surprise me!',
    '🍱 Lunch spots?',
    '🎯 Activities nearby',
  ],
  evening: [
    '🎲 Surprise me!',
    '🍽️ Dinner spots?',
    '🍻 Bars nearby?',
  ],
  night: [
    '🎲 Surprise me!',
    '🌙 Late night eats',
    '📅 Plan tomorrow',
  ],
};

// Welcome prompts for new trips (no messages yet)
const welcomePrompts = [
  '🗺️ Set up my itinerary',
  '📍 Add places from YouTube',
  '💬 Just explore',
];

export function QuickPrompts({ onPromptPress, timeOfDay = 'morning', isNewTrip = false, style }: QuickPromptsProps) {
  // Show welcome prompts for new trips, otherwise time-based prompts
  const prompts = isNewTrip 
    ? welcomePrompts 
    : (timeBasedPrompts[timeOfDay] || timeBasedPrompts.morning);

  const handlePress = (prompt: string) => {
    HapticFeedback.light();
    // Remove emoji for the actual query
    const cleanPrompt = prompt.replace(/^[^\w\s]+\s*/, '');
    onPromptPress(cleanPrompt);
  };

  return (
    <View style={[styles.container, style]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {prompts.map((prompt, index) => (
          <MotiView
            key={prompt}
            from={{ opacity: 0, translateX: 20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ 
              type: 'timing', 
              delay: index * 100,
              duration: 200,
            }}
          >
            <TouchableOpacity
              style={styles.promptChip}
              onPress={() => handlePress(prompt)}
              activeOpacity={0.7}
            >
              <Text style={styles.promptText}>{prompt}</Text>
            </TouchableOpacity>
          </MotiView>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  
  // Basic suggestion chips
  chip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...theme.shadows.neopop.sm,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },

  // Category chips
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 6,
    ...theme.shadows.neopop.sm,
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginRight: 8,
  },
  categoryLabelSelected: {
    color: theme.colors.textInverse,
  },
  categoryBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  categoryCount: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },

  // Quick prompt chips
  promptChip: {
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  promptText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});

export default QuickActionChips;

