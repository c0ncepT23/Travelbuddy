# Location Accuracy, Navigation & Proactive Notification System Plan

## Overview
Verify and enhance the location-based features: marker accuracy, Google Maps navigation, proximity alerts, and build an intelligent notification system to engage users.

## 1. Test Location Marker Accuracy

### Current State
- Geocoding uses Google Maps API
- Places have `location_confidence` (high/medium/low)
- Coordinates stored as `location_lat` and `location_lng`

### Testing Tasks
1. **Manual Verification**:
   - Pick 5 saved places from your Japan trip
   - Check if map markers are at the correct location
   - Compare with actual Google Maps search
   - Document any misplaced markers

2. **Confidence Score Analysis**:
   - Query database: `SELECT name, location_confidence, location_confidence_score FROM saved_items WHERE trip_group_id = 'xxx'`
   - Check if "low confidence" places are indeed inaccurate
   - Identify patterns (e.g., "shopping malls" always low confidence)

3. **Improvements if Needed**:
   - Add manual correction UI (drag marker to correct location)
   - Show confidence badge on place cards
   - Allow users to report incorrect locations

### Implementation
- Add `location_confidence` badge to place cards (color-coded: green/yellow/red)
- Log geocoding results to identify common failures

## 2. Test Google Maps Navigation

### Current State
- "📍 Navigate" button exists
- Opens: `https://www.google.com/maps/search/?api=1&query={lat},{lng}`

### Testing Tasks
1. **Functional Test**:
   - Click navigate on 3 different places
   - Verify Google Maps app opens (not browser)
   - Verify it shows the correct location
   - Verify directions work

2. **Edge Cases**:
   - Test with place that has no coordinates (should show alert)
   - Test on iOS vs Android (different URL schemes)

3. **Improvements**:
   - Use place name + coordinates for better results: `&query={name}+{lat},{lng}`
   - Add option to open in Waze, Apple Maps, or Google Maps (user choice)

### Implementation
- Update `openInGoogleMaps()` to use enhanced URL format
- Add platform-specific handling (iOS: `comgooglemaps://`, Android: `geo:`)

## 3. Test Proximity Notifications (500m Radius)

### Current State
- Background location tracking runs every 60 seconds
- Checks for places within 500m
- **Logs show**: "Nearby items: 0" (needs investigation)

### Testing Tasks
1. **Simulate Location**:
   - Use Android Studio's emulator location override
   - Set location to coordinates of a saved place
   - Verify notification is sent

2. **Real-World Test**:
   - Actually visit a location you saved (if possible)
   - Check if notification arrives
   - Verify cooldown works (no spam)

3. **Debug Current Issue**:
   - Logs show "Nearby items: 0" - why?
   - Check if saved places have valid coordinates
   - Check if radius calculation is correct
   - Add more logging to proximity check

### Implementation
**Backend:**
- Add detailed logging to `/location/:tripId/nearby` endpoint
- Verify SQL query is correct (currently uses bounding box + Haversine)

**Mobile:**
- Add test button: "Simulate Nearby Alert"
- Show distance to each saved place in debug mode

## 4. Build Proactive Notification System

### Goal
Send **engaging, timely notifications** to keep users coming back.

### Notification Types

#### A. Proximity Alerts (Already Exists)
"You're near Ichiran Ramen! 🍜 Want to check it out?"

#### B. Random Check-In Nudge (NEW!)
**Trigger**: User hasn't opened app in 2 days  
**Message**: "Did you try [Random Place] yet? Let us know! 😊"  
**Action**: Opens app to that place's detail

#### C. Pre-Trip Reminders (NEW!)
**Trigger**: 3 days before trip start date  
**Message**: "Japan trip in 3 days! 🇯🇵 You've saved 24 places. Ready?"  
**Action**: Opens trip detail

#### D. Post-Check-In Follow-Up (NEW!)
**Trigger**: 2 hours after checking in  
**Message**: "How was [Place Name]? Rate it! ⭐"  
**Action**: Opens rating dialog

### Implementation Plan

#### Step 1: Set Up Scheduled Jobs
**Tool**: `node-cron` or Railway's cron jobs

```typescript
// backend/src/jobs/notificationScheduler.ts
import cron from 'node-cron';

// Run every day at 9 AM
cron.schedule('0 9 * * *', async () => {
  await sendDailyNudges();
});
```

#### Step 2: Create Notification Service
```
backend/src/services/notification.service.ts
```

**Methods:**
- `sendProximityAlert(userId, place, distance)` - Already exists
- `sendRandomCheckInNudge(userId, tripId)` - NEW
- `sendPreTripReminder(userId, tripId, daysUntil)` - NEW
- `sendPostCheckInFollowUp(userId, checkInId)` - NEW

#### Step 3: Implement Random Nudge Logic
```typescript
async function sendRandomCheckInNudge(userId: string, tripId: string) {
  // 1. Get all UNVISITED places for this user in this trip
  const unvisitedPlaces = await getUnvisitedPlaces(userId, tripId);
  
  if (unvisitedPlaces.length === 0) return;
  
  // 2. Pick a random one
  const randomPlace = unvisitedPlaces[Math.floor(Math.random() * unvisitedPlaces.length)];
  
  // 3. Send notification
  await sendPushNotification(userId, {
    title: `Did you try ${randomPlace.name}? 🤔`,
    body: `Let us know how it was!`,
    data: { type: 'place_nudge', placeId: randomPlace.id }
  });
}
```

#### Step 4: Mobile - Handle Notification Taps
Update `notificationService.ts` to handle notification types and navigate accordingly.

## 5. Firebase Cloud Messaging Setup

### Current Issue
Logs show: `FirebaseApp is not initialized`

### Fix Required
1. **Install Firebase**:
   ```bash
   cd mobile
   npx expo install @react-native-firebase/app @react-native-firebase/messaging
   ```

2. **Configure Firebase**:
   - Create Firebase project
   - Download `google-services.json` (Android)
   - Download `GoogleService-Info.plist` (iOS)
   - Add to project

3. **Update `app.json`**:
   ```json
   {
     "expo": {
       "plugins": [
         "@react-native-firebase/app"
       ],
       "android": {
         "googleServicesFile": "./google-services.json"
       }
     }
   }
   ```

**Alternative (Simpler)**: Use **Expo Push Notifications** (no Firebase needed)
- Already integrated in code
- Works out of the box
- Good for MVP

## 6. Implementation Priorities

### HIGH PRIORITY (Do First)
1. ✅ Fix Firebase/Expo notifications initialization
2. ✅ Test proximity alerts with simulated location
3. ✅ Build random check-in nudge notification

### MEDIUM PRIORITY
4. ✅ Test location marker accuracy
5. ✅ Enhance Google Maps navigation
6. ✅ Add confidence badges to UI

### LOW PRIORITY (Future)
7. Pre-trip reminders
8. Post-check-in follow-ups
9. Manual marker correction UI

## 7. Testing Checklist

### Location Accuracy
- [ ] Open 5 different places on map
- [ ] Verify markers are at correct locations
- [ ] Check confidence scores in database
- [ ] Document any inaccuracies

### Navigation
- [ ] Click "Navigate" on 3 places
- [ ] Verify Google Maps opens
- [ ] Verify correct destination
- [ ] Test on both Android and iOS

### Proximity Notifications
- [ ] Use emulator location override
- [ ] Set location near a saved place
- [ ] Wait for notification (should arrive within 60 seconds)
- [ ] Verify cooldown works (no spam)

### Random Nudge
- [ ] Manually trigger notification job
- [ ] Verify notification arrives
- [ ] Tap notification → Should open place detail
- [ ] Check that only unvisited places are selected

---

**Ready to implement?** Let's start with fixing notifications and building the random nudge system!

