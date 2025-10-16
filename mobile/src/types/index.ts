// User Types
export interface User {
  id: string;
  email?: string; // Optional for phone-based auth
  phone_number?: string; // Primary auth method
  name: string;
  avatar_url?: string;
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
  metadata?: any;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
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

