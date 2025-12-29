# Chat 29 Summary: Explore Tab & UX Overhaul

## 1. Primary Request and Intent
The user wanted to improve the discovery experience for AI-suggested places and fix map interaction issues. The core intent was to move AI suggestions out of the chat interface and into a dedicated "Explore" tab within each trip, while also removing restrictive map boundaries and fixing pin filtering bugs.

## 2. Key Technical Concepts
- **UX Redesign**: Moving discovery from transient chat chips to a persistent "Explore" tab.
- **Cost Optimization**: A hybrid enrichment strategy where users can "View" places for free (Google Maps search) and only trigger paid enrichment (Google Places API) when they explicitly "Save" a place.
- **Mapbox Geofencing**: Removed `maxBounds` to allow free navigation across the globe.
- **Coordinate Normalization**: Implemented robust longitude wrapping to handle Mapbox's world-wrapping coordinate system (e.g., handling bounds like `[170, -170]` when crossing the antimeridian).
- **Backend API Design**: New endpoint for on-demand enrichment of discovery items.

## 3. Files and Code Sections

### `mobile/src/screens/World/CountryBubbleScreen.tsx`
- **Map Freedom**: Removed `maxBounds` from the `Camera` component.
- **Bottom Tab Navigation**: Implemented a custom bottom tab bar with "Map" and "Explore" tabs.
- **Conditional Rendering**: Switches between the Mapbox view and the new `ExploreTab` component.
- **UI Polishing**: Adjusted z-indices (500) and styling (compact mode) for the tab bar to ensure visibility and modern aesthetics.
- **Antimeridian Fix**: Modified `filterItemsByMapBounds` to correctly normalize longitudes, fixing the "disappearing pins" bug when zooming out.

### `mobile/src/components/ExploreTab.tsx` (New)
- **Discovery View**: Displays AI-suggested places (discovery queue) grouped by their source video (YouTube/Instagram).
- **Video Linking**: Shows platform icons and links directly back to the source video.
- **Action Flow**:
  - **View**: Opens Google Maps search directly (cost: $0).
  - **Save**: Calls backend to enrich with full data (photos, ratings, exact coords) and adds to trip.
  - **Dismiss**: Removes from the discovery list.

### `mobile/src/components/PersistentPlacesDrawer.tsx`
- **Layout Adjustment**: Updated the drawer to sit exactly above the new bottom tab bar using `TAB_BAR_HEIGHT` offsets for all snap points.

### `mobile/src/screens/Chat/ChatScreen.tsx`
- **Cleanup**: Removed the discovery queue chips, state, and logic, as these have been superseded by the Explore tab.

### `backend/src/controllers/savedItem.controller.ts` & `trip.routes.ts`
- **New Endpoint**: `POST /api/trips/:tripId/items/from-discovery`
- **Enrichment Logic**: Takes a discovery item, searches Google Places, and converts it into a fully enriched `saved_item`.

## 4. Errors and Fixes
- **Disappearing Pins**: Fixed by normalizing longitudes in `filterItemsByMapBounds`. Previously, Mapbox would return bounds like `[190, 45]` which wouldn't match database coordinates stored as `[-170, 45]`.
- **Missing USA Pins**: Identified that 7 out of 10 saved USA places lacked coordinates. The new Explore flow ensures future saved places are always enriched with coordinates.
- **Tab Bar Visibility**: Fixed z-index and elevation issues where the drawer or map would sometimes overlap the menu items.

## 5. Pending Tasks
- **Migration**: Run `008_video_cache.sql` in production/Supabase if not already applied.
- **Cleanup**: The legacy `ScoutCarousel` in `CountryBubbleScreen` is currently deactivated but still present in code; consider full removal in next session.

