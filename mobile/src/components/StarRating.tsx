import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: 'small' | 'medium' | 'large';
  showReviewCount?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({ 
  rating, 
  reviewCount = 0,
  size = 'medium',
  showReviewCount = true,
}) => {
  const starSize = size === 'small' ? 12 : size === 'large' ? 20 : 16;
  const fontSize = size === 'small' ? 12 : size === 'large' ? 18 : 14;

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Text key={`full-${i}`} style={[styles.star, { fontSize: starSize }]}>⭐</Text>);
    }

    // Half star
    if (hasHalfStar) {
      stars.push(<Text key="half" style={[styles.star, { fontSize: starSize }]}>⭐</Text>);
    }

    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Text key={`empty-${i}`} style={[styles.emptyStar, { fontSize: starSize }]}>☆</Text>);
    }

    return stars;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.ratingText, { fontSize }]}>
        {rating.toFixed(1)}
      </Text>
      <View style={styles.starsContainer}>
        {renderStars()}
      </View>
      {showReviewCount && reviewCount > 0 && (
        <Text style={[styles.reviewCount, { fontSize: fontSize - 2 }]}>
          ({reviewCount})
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginLeft: 4,
  },
  ratingText: {
    fontWeight: '600',
    color: '#000',
  },
  star: {
    color: '#FFB800',
    marginHorizontal: 1,
  },
  emptyStar: {
    color: '#E0E0E0',
    marginHorizontal: 1,
  },
  reviewCount: {
    color: '#8E8E93',
    marginLeft: 4,
  },
});

