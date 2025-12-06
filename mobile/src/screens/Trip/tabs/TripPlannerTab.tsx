import React, { useState } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useTripStore } from '../../../stores/tripStore';
import { DayPlannerView } from '../../../components/DayPlannerView';
import { PlaceDetailCard } from '../../../components/PlaceDetailCard';
import { SavedItem } from '../../../types';

interface TripPlannerTabProps {
  tripId: string;
  navigation: any;
}

export default function TripPlannerTab({ tripId, navigation }: TripPlannerTabProps) {
  const { currentTrip } = useTripStore();
  const [selectedPlace, setSelectedPlace] = useState<SavedItem | null>(null);

  const handlePlaceSelect = (place: SavedItem) => {
    setSelectedPlace(place);
  };

  const handleClose = () => {
    // This won't actually close anything since we're in a tab
    // But we keep the prop for compatibility
  };

  if (!currentTrip) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <DayPlannerView
        trip={currentTrip}
        tripId={tripId}
        onPlaceSelect={handlePlaceSelect}
        onClose={handleClose}
      />

      {/* Place Detail Card Overlay */}
      {selectedPlace && (
        <View style={styles.placeCardOverlay}>
          <PlaceDetailCard
            place={selectedPlace}
            onClose={() => setSelectedPlace(null)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  placeCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 16,
    paddingBottom: 80,
  },
});

