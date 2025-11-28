import { Request } from 'express';

// User Types
export interface User {
  id: string;
  email?: string; // Optional now (phone-based auth)
  phone_number?: string; // Primary auth method
  password_hash?: string;
  name: string;
  avatar_url?: string;
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

