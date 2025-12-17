import { Request } from 'express';

// User Types
export interface User {
  id: string;
  email?: string; // Optional now (phone-based auth)
  phone_number?: string; // Primary auth method
  password_hash?: string;
  name: string;
  avatar_url?: string;
  cover_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface AuthUser {
  id: string;
  email?: string; // Optional
  phone_number?: string; // Primary identifier
  name: string;
  avatar_url?: string;
}

// Trip Group Types
export interface TripGroup {
  id: string;
  name: string;
  destination: string;
  start_date?: Date;
  end_date?: Date;
  invite_code: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export enum TripMemberRole {
  OWNER = 'owner',
  MEMBER = 'member',
}

export interface TripMember {
  id: string;
  trip_group_id: string;
  user_id: string;
  role: TripMemberRole;
  joined_at: Date;
}

// Message Types
export enum MessageSenderType {
  USER = 'user',
  AGENT = 'agent',
}

export enum MessageType {
  TEXT = 'text',
  LINK = 'link',
  PHOTO = 'photo',
  VOICE = 'voice',
  SYSTEM = 'system',
}

export interface ChatMessage {
  id: string;
  trip_group_id: string;
  sender_id: string | null;
  sender_type: MessageSenderType;
  message_type: MessageType;
  content: string;
  metadata?: any;
  created_at: Date;
}

// Saved Item Types
export enum ItemCategory {
  FOOD = 'food',
  ACCOMMODATION = 'accommodation',
  PLACE = 'place',
  SHOPPING = 'shopping',
  ACTIVITY = 'activity',
  TIP = 'tip',
}

export enum ItemSourceType {
  YOUTUBE = 'youtube',
  INSTAGRAM = 'instagram',
  REDDIT = 'reddit',
  URL = 'url',
  PHOTO = 'photo',
  VOICE = 'voice',
  TEXT = 'text',
}

export enum ItemStatus {
  SAVED = 'saved',
  VISITED = 'visited',
}

export interface SavedItem {
  id: string;
  trip_group_id: string;
  added_by: string;
  name: string;
  category: ItemCategory;
  description: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  original_source_type: ItemSourceType;
  original_source_url?: string;
  source_title?: string;
  original_content?: any;
  status: ItemStatus;
  created_at: Date;
  updated_at: Date;
  // Google Places enrichment fields
  google_place_id?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  formatted_address?: string;
  area_name?: string;
  photos_json?: any;
  opening_hours_json?: any;
  // User preference fields
  is_favorite?: boolean;
  is_must_visit?: boolean;
  user_notes?: string;  // Personal notes about this place
  // Day planner fields
  planned_day?: number | null;  // Day number (1 = Day 1, null = Unassigned)
  day_order?: number;           // Order within the day
  // Sub-categorization fields (for smart clustering)
  tags?: string[];              // ["michelin", "hidden gem", "local favorite"]
  cuisine_type?: string;        // For food: "ramen", "wagyu", "cheesecake"
  place_type?: string;          // For places: "temple", "shrine", "market"
  destination?: string;         // Auto-detected destination: "Tokyo", "Japan"
  destination_id?: string;      // Link to destinations table
}

// Destination for auto-grouping (replaces mandatory trip creation)
export interface Destination {
  id: string;
  user_id: string;
  name: string;                 // "Japan", "Tokyo", "Paris"
  country?: string;
  country_code?: string;
  cover_image_url?: string;
  total_places: number;
  created_at: Date;
  updated_at: Date;
}

export interface ItemVisit {
  id: string;
  saved_item_id: string;
  user_id: string;
  visited_at: Date;
  notes?: string;
}

// Request Types
export interface AuthRequest extends Request {
  user?: AuthUser;
}

// Content Processing Types
export interface ProcessedContent {
  name: string;
  category: ItemCategory;
  description: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  source_title?: string;
  original_content?: any;
  // Google Places enrichment fields
  google_place_id?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  formatted_address?: string;
  area_name?: string;
  photos_json?: any[];
  opening_hours_json?: any;
  // Sub-categorization fields
  cuisine_type?: string;        // For food: "ramen", "wagyu", "cheesecake"
  place_type?: string;          // For places: "temple", "shrine", "market"
  tags?: string[];              // ["michelin", "hidden gem", "local favorite"]
  destination?: string;         // Auto-detected: "Tokyo", "Japan"
  destination_country?: string; // Country name: "Japan"
}

export interface YouTubeVideoData {
  title: string;
  description: string;
  transcript: string;
  thumbnail_url: string;
  thumbnail: string;
  channel: string;
}

export interface InstagramPostData {
  caption: string;
  images: string[];
  location?: string;
}

export interface RedditPostData {
  title: string;
  body: string;
  comments: string[];
}

// Location Types
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface NearbyItem extends SavedItem {
  distance: number; // in meters
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Agent Types
export interface AgentContext {
  tripGroupId: string;
  userId: string;
  userName: string;
  tripName: string;
  destination: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AgentFunction {
  name: string;
  description: string;
  parameters: any;
}

// Trip Segment Types (for itinerary tracking)
export interface TripSegment {
  id: string;
  trip_group_id: string;
  city: string;
  area?: string;
  country?: string;
  timezone?: string;
  start_date: Date;
  end_date: Date;
  accommodation_name?: string;
  accommodation_address?: string;
  accommodation_lat?: number;
  accommodation_lng?: number;
  accommodation_place_id?: string;
  order_index: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export interface TripSegmentWithStats extends TripSegment {
  places_count: number;
  visited_count: number;
}

export interface CurrentSegmentInfo {
  segment: TripSegment | null;
  dayNumber: number;
  totalDays: number;
  daysRemaining: number;
  isTransitDay: boolean;
}

// Daily Plan Types
export interface DailyPlanStop {
  saved_item_id?: string; // Optional for guide-imported plans where items aren't saved yet
  order: number;
  planned_time?: string;
  duration_minutes?: number;
  notes?: string;
  place_name?: string; // For guide-imported plans without saved items
}

export interface DailyPlan {
  id: string;
  trip_group_id: string;
  segment_id?: string;
  plan_date: Date;
  title?: string;
  stops: DailyPlanStop[];
  route_data?: any;
  total_duration_minutes?: number;
  total_distance_meters?: number;
  status: 'active' | 'completed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

// Notification Preferences Types
export interface NotificationPreferences {
  id: string;
  user_id: string;
  trip_group_id?: string;
  morning_briefing: boolean;
  meal_suggestions: boolean;
  nearby_alerts: boolean;
  evening_recap: boolean;
  segment_alerts: boolean;
  quiet_start: string;
  quiet_end: string;
  max_daily_notifications: number;
  created_at: Date;
  updated_at: Date;
}

// Enhanced Companion Context (for intelligent suggestions)
export interface CompanionContext {
  // Time context
  currentDate: Date;
  currentTime: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
  
  // User location
  userLocation?: {
    lat: number;
    lng: number;
  };
  
  // Itinerary context
  hasItinerary: boolean;
  currentSegment?: {
    id: string;
    city: string;
    startDate: Date;
    endDate: Date;
    dayNumber: number;
    totalDays: number;
    daysRemaining: number;
    hotel?: {
      name: string;
      lat: number;
      lng: number;
      address: string;
    };
  };
  nextSegment?: {
    city: string;
    startDate: Date;
    daysUntil: number;
  };
  
  // Places context
  savedPlaces: {
    total: number;
    inCurrentCity: number;
    unvisitedInCity: number;
    visitedInCity: number;
    nearbyNow: SavedItem[];
    topRated: SavedItem[];
    mustVisit: SavedItem[];
    byCategory: {
      food: number;
      place: number;
      shopping: number;
      activity: number;
      accommodation: number;
      tip: number;
    };
  };
  
  // Trip context
  tripId: string;
  tripName: string;
  destination: string;
  tripStartDate?: Date;
  tripEndDate?: Date;
  groupMembers: Array<{ id: string; name: string }>;
  
  // User context
  userId: string;
  userName: string;
}

