/**
 * Map Background Component
 * 
 * SVG-based map background that shows:
 * - Country silhouette (Japan outline)
 * - Subtle grid/road pattern
 * - Very low opacity for dreamy effect
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Rect, Line, Defs, Pattern } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MapBackgroundProps {
  country?: string;
  viewType?: 'country' | 'city';
}

export const MapBackground: React.FC<MapBackgroundProps> = ({
  country = 'japan',
  viewType = 'country',
}) => {
  // Japan silhouette path (simplified)
  const japanPath = `
    M 180 120 
    Q 200 100 220 110 
    L 235 140 
    Q 245 170 235 200 
    L 220 210 
    Q 200 200 190 180 
    L 180 150 
    Z
    M 200 230 
    Q 215 220 230 225 
    L 245 250 
    Q 240 280 225 290 
    L 210 275 
    Q 200 255 200 230 
    Z
    M 160 280
    Q 175 270 190 275
    L 200 300
    Q 195 330 180 340
    L 165 320
    Q 155 295 160 280
    Z
  `;

  return (
    <View style={styles.container}>
      <Svg 
        width={SCREEN_WIDTH} 
        height={SCREEN_HEIGHT} 
        style={styles.svg}
      >
        {viewType === 'country' ? (
          // Country view - show outline
          <>
            {/* Water background */}
            <Rect x="0" y="0" width="100%" height="100%" fill="#E0F2FE" opacity={0.3} />
            
            {/* Land mass - Japan shape */}
            <Path
              d={japanPath}
              fill="#D1FAE5"
              stroke="#86EFAC"
              strokeWidth={2}
              opacity={0.4}
              transform={`scale(${SCREEN_WIDTH / 400}, ${SCREEN_HEIGHT / 500})`}
            />
          </>
        ) : (
          // City view - grid pattern
          <>
            <Defs>
              <Pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <Rect width="60" height="60" fill="#F8F8F8" />
                <Line x1="0" y1="0" x2="0" y2="60" stroke="#E5E7EB" strokeWidth={1} />
                <Line x1="0" y1="0" x2="60" y2="0" stroke="#E5E7EB" strokeWidth={1} />
              </Pattern>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#grid)" opacity={0.3} />
            
            {/* Main roads */}
            <Line x1="0" y1="200" x2={SCREEN_WIDTH} y2="200" stroke="#FCD34D" strokeWidth={4} opacity={0.2} />
            <Line x1="0" y1="400" x2={SCREEN_WIDTH} y2="400" stroke="#FCD34D" strokeWidth={4} opacity={0.2} />
            <Line x1="200" y1="0" x2="200" y2={SCREEN_HEIGHT} stroke="#FCD34D" strokeWidth={4} opacity={0.2} />
          </>
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  svg: {
    opacity: 0.5,
  },
});

export default MapBackground;

