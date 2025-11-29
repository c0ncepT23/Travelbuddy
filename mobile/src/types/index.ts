// User Types
export interface User {
  id: string;
  email?: string; // Optional for phone-based auth
  phone_number?: string; // Primary auth method
  name: string;
  avatar_url?: string;
  cover_url?: string;
  created_at: string;
  updated_at: string;
}

// Trip Types
export interface Trip {
  id: string;
  name: string;
  destination: string;
  start_date?: string;
  end_date?: string;
  invite_code: string;
  banner_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TripMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: 'owner' | 'member';
  joined_at: string;
}

// Message Types
export interface Message {
  id: string;
  trip_group_id: string;
  sender_id: string | null;
  sender_type: 'user' | 'agent';
  message_type: 'text' | 'link' | 'photo' | 'voice' | 'system';
  content: string;
  metadata?: MessageMetadata;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

// Message Metadata Types
export interface MessageMetadata {
  type?: 'pending_import' | 'location_alert' | string;
  source_url?: string;
  source_type?: 'youtube' | 'reddit' | 'instagram';
  video_title?: string;
  summary?: string;
  places?: PendingImportPlace[];
  user_id?: string;
  location?: string;
  [key: string]: any;
}

// Pending Import Types
export interface PendingImportPlace {
  name: string;
  category: ItemCategory;
  description: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  location_confidence?: 'high' | 'medium' | 'low';
  location_confidence_score?: number;
  source_title?: string;
  originalContent?: any;
}

export interface ImportModalData {
  visible: boolean;
  sourceUrl: string;
  sourceType: 'youtube' | 'reddit' | 'instagram';
  sourceTitle: string;
  summary?: string;
  places: PendingImportPlace[];
  tripId: string;
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

export enum ItemStatus {
  SAVED = 'saved',
  VISITED = 'visited',
}

export interface ItemTag {
  group: string;
  value: string;
  confidence?: number;
  source?: string;
}

export interface TagFilter {
  group: string;
  value: string;
}

export interface TagFacet {
  group: string;
  value: string;
  count: number;
  averageConfidence: number;
}

export interface TagGroupItems {
  value: string;
  items: SavedItem[];
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
  location_confidence?: 'high' | 'medium' | 'low';
  location_confidence_score?: number;
  original_source_type: string;
  original_source_url?: string;
  source_title?: string;
  original_content?: any;
  status: ItemStatus;
  created_at: string;
  updated_at: string;
  distance?: number;
  tags?: ItemTag[];
  primary_tag?: string | null;
  primary_tag_group?: string | null;
  primary_tag_confidence?: number;
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
}

// Check-in types
export interface CheckIn {
  id: string;
  user_id: string;
  trip_group_id: string;
  saved_item_id: string;
  checked_in_at: string;
  checked_out_at?: string;
  duration_minutes?: number;
  rating?: number;
  note?: string;
  cost?: number;
  currency?: string;
  photos?: string[];
  actual_location_lat?: number;
  actual_location_lng?: number;
  weather?: string;
  with_users?: string[];
  is_auto_checkin?: boolean;
  is_visible?: boolean;
  shared_publicly?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimelineItem extends CheckIn {
  place_name: string;
  place_category: string;
  place_description: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  location_confidence?: string;
  username: string;
}

export interface DayTimeline {
  date: string;
  day_number: number;
  check_ins: TimelineItem[];
  stats: {
    total_places: number;
    total_duration_minutes: number;
    total_cost: number;
    avg_rating?: number;
  };
}

export interface TripStory {
  id: string;
  trip_group_id: string;
  user_id: string;
  share_code: string;
  slug?: string;
  is_public: boolean;
  title?: string;
  description?: string;
  hero_image_url?: string;
  cover_photos?: string[];
  theme_color?: string;
  show_ratings: boolean;
  show_photos: boolean;
  show_costs: boolean;
  show_notes: boolean;
  show_companions: boolean;
  views_count: number;
  copies_count: number;
  shares_count: number;
  last_viewed_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TripStats {
  trip_id: string;
  trip_name: string;
  destination: string;
  total_checkins: number;
  unique_places: number;
  days_active: number;
  avg_rating?: number;
  total_cost?: number;
  total_time_minutes?: number;
  first_checkin?: string;
  last_checkin?: string;
}

// Day Planner Types
export interface DayGroup {
  day: number | null;  // null = Unassigned
  items: SavedItem[];
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth Types
export interface LoginRequest {
  // Email-based auth (old)
  email?: string;
  password?: string;
  // Phone-based auth (new)
  phoneNumber?: string;
  otpCode?: string;
}

export interface RegisterRequest {
  // Email-based auth (old)
  email?: string;
  password?: string;
  // Phone-based auth (new)
  phoneNumber?: string;
  otpCode?: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Register: undefined;
  TripList: undefined;
  TripDetail: { tripId: string };
  Chat: { tripId: string };
  CreateTrip: undefined;
  JoinTrip: undefined;
  ItemDetail: { itemId: string };
  BrowseItems: { tripId: string };
  Settings: undefined;
};

