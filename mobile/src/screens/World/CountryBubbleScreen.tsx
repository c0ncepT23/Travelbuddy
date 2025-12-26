/**
 * Country Bubble Screen - V4 with Auto-Location Focus
 * 
 * Features:
 * - Auto-detect if user is in the trip's country
 * - Auto-focus to user's GPS location with smart radius
 * - "Near Me" / "All Places" navigation buttons
 * - AI Chat understands location + radius queries
 * - Smart radius: 5km default, expands to 10km if <3 places
 */

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity, 
  ActivityIndicator, 
  Platform, 
  StatusBar, 
  Keyboard, 
  Linking, 
  ScrollView,
  BackHandler,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import Mapbox, { MapView, Camera, ShapeSource, CircleLayer, SymbolLayer, Images } from '@rnmapbox/maps';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import api from '../../config/api';

// Initialize Mapbox
const MAPBOX_TOKEN = Constants.expoConfig?.extra?.mapboxAccessToken || 
                     process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
Mapbox.setAccessToken(MAPBOX_TOKEN);
import { SavedItem, ItemCategory, SubClusters } from '../../types';
import { FloatingAIOrb } from '../../components/FloatingAIOrb';
import { CompactAIChat } from '../../components/CompactAIChat';
import { GameBottomSheet, GameBottomSheetRef } from '../../components/GameBottomSheet';
import { PlaceDetailSheet, PlaceDetailSheetRef } from '../../components/PlaceDetailSheet';
import { PersistentPlacesDrawer, PersistentPlacesDrawerRef } from '../../components/PersistentPlacesDrawer';
// Removed: FloatingCloud, GlowingBubble, OrbitalBubbles - replaced with Mapbox clusters
import { useCompanionStore } from '../../stores/companionStore';
import { useLocationStore } from '../../stores/locationStore';

import { SkeletonLoader } from '../../components/SkeletonLoader';
import { ScoutCarousel, ScoutResult } from '../../components/ScoutCarousel';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Default radius settings (in km)
const DEFAULT_RADIUS_KM = 5;
const EXPANDED_RADIUS_KM = 10;
const MIN_PLACES_THRESHOLD = 3;

// ============================================================
// CITY/AREA COORDINATES DATABASE
// ============================================================
interface CityCoords {
  latitude: number;
  longitude: number;
  latDelta: number;
  lngDelta: number;
  aliases?: string[];
}

// Country bounding boxes (rough) for checking if user is in country
const COUNTRY_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  japan: { minLat: 24, maxLat: 46, minLng: 122, maxLng: 154 },
  thailand: { minLat: 5, maxLat: 21, minLng: 97, maxLng: 106 },
  korea: { minLat: 33, maxLat: 39, minLng: 124, maxLng: 132 },
  vietnam: { minLat: 8, maxLat: 24, minLng: 102, maxLng: 110 },
  singapore: { minLat: 1.1, maxLat: 1.5, minLng: 103.6, maxLng: 104.1 },
  indonesia: { minLat: -11, maxLat: 6, minLng: 95, maxLng: 141 },
  malaysia: { minLat: 0, maxLat: 8, minLng: 99, maxLng: 120 },
  india: { minLat: 6, maxLat: 36, minLng: 68, maxLng: 98 },
  china: { minLat: 18, maxLat: 54, minLng: 73, maxLng: 135 },
  usa: { minLat: 24, maxLat: 50, minLng: -125, maxLng: -66 },
  france: { minLat: 41, maxLat: 51, minLng: -5, maxLng: 10 },
  italy: { minLat: 36, maxLat: 47, minLng: 6, maxLng: 19 },
  spain: { minLat: 36, maxLat: 44, minLng: -10, maxLng: 5 },
  uk: { minLat: 49, maxLat: 61, minLng: -8, maxLng: 2 },
  australia: { minLat: -44, maxLat: -10, minLng: 112, maxLng: 154 },
};

// Major cities by country
const CITY_COORDS: Record<string, Record<string, CityCoords>> = {
  japan: {
    tokyo: { latitude: 35.6762, longitude: 139.6503, latDelta: 0.4, lngDelta: 0.4, aliases: ['東京'] },
    osaka: { latitude: 34.6937, longitude: 135.5023, latDelta: 0.3, lngDelta: 0.3, aliases: ['大阪'] },
    kyoto: { latitude: 35.0116, longitude: 135.7681, latDelta: 0.2, lngDelta: 0.2, aliases: ['京都'] },
    shibuya: { latitude: 35.6580, longitude: 139.7016, latDelta: 0.05, lngDelta: 0.05 },
    shinjuku: { latitude: 35.6938, longitude: 139.7034, latDelta: 0.05, lngDelta: 0.05, aliases: ['新宿'] },
    harajuku: { latitude: 35.6702, longitude: 139.7027, latDelta: 0.03, lngDelta: 0.03, aliases: ['原宿'] },
    ginza: { latitude: 35.6717, longitude: 139.7649, latDelta: 0.03, lngDelta: 0.03, aliases: ['銀座'] },
    akihabara: { latitude: 35.7023, longitude: 139.7745, latDelta: 0.03, lngDelta: 0.03, aliases: ['秋葉原'] },
    roppongi: { latitude: 35.6628, longitude: 139.7315, latDelta: 0.03, lngDelta: 0.03, aliases: ['六本木'] },
    asakusa: { latitude: 35.7148, longitude: 139.7967, latDelta: 0.03, lngDelta: 0.03, aliases: ['浅草'] },
    ikebukuro: { latitude: 35.7295, longitude: 139.7109, latDelta: 0.05, lngDelta: 0.05, aliases: ['池袋'] },
    yokohama: { latitude: 35.4437, longitude: 139.6380, latDelta: 0.2, lngDelta: 0.2 },
    nara: { latitude: 34.6851, longitude: 135.8048, latDelta: 0.15, lngDelta: 0.15 },
    hiroshima: { latitude: 34.3853, longitude: 132.4553, latDelta: 0.2, lngDelta: 0.2 },
    fukuoka: { latitude: 33.5904, longitude: 130.4017, latDelta: 0.2, lngDelta: 0.2 },
    sapporo: { latitude: 43.0618, longitude: 141.3545, latDelta: 0.2, lngDelta: 0.2 },
    okinawa: { latitude: 26.2124, longitude: 127.6809, latDelta: 0.5, lngDelta: 0.5, aliases: ['naha'] },
    dotonbori: { latitude: 34.6687, longitude: 135.5013, latDelta: 0.02, lngDelta: 0.02 },
    umeda: { latitude: 34.7055, longitude: 135.4983, latDelta: 0.03, lngDelta: 0.03 },
  },
  thailand: {
    bangkok: { latitude: 13.7563, longitude: 100.5018, latDelta: 0.3, lngDelta: 0.3, aliases: ['krung thep', 'bkk'] },
    chiangmai: { latitude: 18.7883, longitude: 98.9853, latDelta: 0.2, lngDelta: 0.2, aliases: ['chiang mai'] },
    phuket: { latitude: 7.8804, longitude: 98.3923, latDelta: 0.3, lngDelta: 0.3 },
    pattaya: { latitude: 12.9236, longitude: 100.8825, latDelta: 0.15, lngDelta: 0.15 },
    sukhumvit: { latitude: 13.7380, longitude: 100.5614, latDelta: 0.05, lngDelta: 0.05 },
    silom: { latitude: 13.7262, longitude: 100.5234, latDelta: 0.03, lngDelta: 0.03 },
    siam: { latitude: 13.7466, longitude: 100.5347, latDelta: 0.03, lngDelta: 0.03 },
    khaoSan: { latitude: 13.7586, longitude: 100.4974, latDelta: 0.02, lngDelta: 0.02, aliases: ['khao san', 'khaosan road'] },
    chatuchak: { latitude: 13.7999, longitude: 100.5501, latDelta: 0.03, lngDelta: 0.03 },
    ayutthaya: { latitude: 14.3692, longitude: 100.5877, latDelta: 0.15, lngDelta: 0.15 },
    krabi: { latitude: 8.0863, longitude: 98.9063, latDelta: 0.3, lngDelta: 0.3 },
    kohsamui: { latitude: 9.5120, longitude: 100.0136, latDelta: 0.2, lngDelta: 0.2, aliases: ['koh samui', 'samui'] },
    chiangrai: { latitude: 19.9105, longitude: 99.8406, latDelta: 0.2, lngDelta: 0.2, aliases: ['chiang rai'] },
  },
  korea: {
    seoul: { latitude: 37.5665, longitude: 126.9780, latDelta: 0.3, lngDelta: 0.3 },
    busan: { latitude: 35.1796, longitude: 129.0756, latDelta: 0.25, lngDelta: 0.25 },
    jeju: { latitude: 33.4996, longitude: 126.5312, latDelta: 0.3, lngDelta: 0.3, aliases: ['jeju island'] },
    gangnam: { latitude: 37.4979, longitude: 127.0276, latDelta: 0.05, lngDelta: 0.05 },
    hongdae: { latitude: 37.5563, longitude: 126.9237, latDelta: 0.03, lngDelta: 0.03 },
    myeongdong: { latitude: 37.5636, longitude: 126.9869, latDelta: 0.02, lngDelta: 0.02 },
    itaewon: { latitude: 37.5345, longitude: 126.9946, latDelta: 0.03, lngDelta: 0.03 },
    insadong: { latitude: 37.5742, longitude: 126.9857, latDelta: 0.02, lngDelta: 0.02 },
    dongdaemun: { latitude: 37.5712, longitude: 127.0095, latDelta: 0.03, lngDelta: 0.03 },
    incheon: { latitude: 37.4563, longitude: 126.7052, latDelta: 0.2, lngDelta: 0.2 },
    gyeongju: { latitude: 35.8562, longitude: 129.2247, latDelta: 0.15, lngDelta: 0.15 },
  },
  vietnam: {
    hanoi: { latitude: 21.0285, longitude: 105.8542, latDelta: 0.2, lngDelta: 0.2, aliases: ['ha noi'] },
    hochiminh: { latitude: 10.8231, longitude: 106.6297, latDelta: 0.25, lngDelta: 0.25, aliases: ['ho chi minh', 'saigon', 'hcmc'] },
    danang: { latitude: 16.0544, longitude: 108.2022, latDelta: 0.2, lngDelta: 0.2, aliases: ['da nang'] },
    hoian: { latitude: 15.8801, longitude: 108.3380, latDelta: 0.1, lngDelta: 0.1, aliases: ['hoi an'] },
    nhatrang: { latitude: 12.2388, longitude: 109.1967, latDelta: 0.15, lngDelta: 0.15, aliases: ['nha trang'] },
    dalat: { latitude: 11.9404, longitude: 108.4583, latDelta: 0.15, lngDelta: 0.15, aliases: ['da lat'] },
    halong: { latitude: 20.9101, longitude: 107.1839, latDelta: 0.2, lngDelta: 0.2, aliases: ['ha long', 'halong bay'] },
    sapa: { latitude: 22.3364, longitude: 103.8438, latDelta: 0.1, lngDelta: 0.1 },
    phuquoc: { latitude: 10.2899, longitude: 103.9840, latDelta: 0.2, lngDelta: 0.2, aliases: ['phu quoc'] },
  },
  singapore: {
    orchard: { latitude: 1.3048, longitude: 103.8318, latDelta: 0.03, lngDelta: 0.03, aliases: ['orchard road'] },
    marinabay: { latitude: 1.2834, longitude: 103.8607, latDelta: 0.03, lngDelta: 0.03, aliases: ['marina bay', 'mbs'] },
    chinatown: { latitude: 1.2836, longitude: 103.8443, latDelta: 0.02, lngDelta: 0.02 },
    littleindia: { latitude: 1.3066, longitude: 103.8518, latDelta: 0.02, lngDelta: 0.02, aliases: ['little india'] },
    sentosa: { latitude: 1.2494, longitude: 103.8303, latDelta: 0.03, lngDelta: 0.03 },
    clarke: { latitude: 1.2906, longitude: 103.8465, latDelta: 0.02, lngDelta: 0.02, aliases: ['clarke quay'] },
    bugis: { latitude: 1.3009, longitude: 103.8558, latDelta: 0.02, lngDelta: 0.02 },
    hollandvillage: { latitude: 1.3111, longitude: 103.7958, latDelta: 0.02, lngDelta: 0.02, aliases: ['holland village', 'holland v'] },
  },
  indonesia: {
    bali: { latitude: -8.4095, longitude: 115.1889, latDelta: 0.5, lngDelta: 0.5 },
    ubud: { latitude: -8.5069, longitude: 115.2625, latDelta: 0.1, lngDelta: 0.1 },
    seminyak: { latitude: -8.6913, longitude: 115.1571, latDelta: 0.05, lngDelta: 0.05 },
    kuta: { latitude: -8.7180, longitude: 115.1686, latDelta: 0.05, lngDelta: 0.05 },
    canggu: { latitude: -8.6478, longitude: 115.1385, latDelta: 0.05, lngDelta: 0.05 },
    jakarta: { latitude: -6.2088, longitude: 106.8456, latDelta: 0.3, lngDelta: 0.3 },
    yogyakarta: { latitude: -7.7956, longitude: 110.3695, latDelta: 0.2, lngDelta: 0.2, aliases: ['jogja', 'yogya'] },
    uluwatu: { latitude: -8.8291, longitude: 115.0849, latDelta: 0.05, lngDelta: 0.05 },
    nusadua: { latitude: -8.8005, longitude: 115.2318, latDelta: 0.05, lngDelta: 0.05, aliases: ['nusa dua'] },
  },
  malaysia: {
    kualalumpur: { latitude: 3.1390, longitude: 101.6869, latDelta: 0.2, lngDelta: 0.2, aliases: ['kuala lumpur', 'kl'] },
    penang: { latitude: 5.4141, longitude: 100.3288, latDelta: 0.2, lngDelta: 0.2, aliases: ['georgetown'] },
    langkawi: { latitude: 6.3500, longitude: 99.8000, latDelta: 0.2, lngDelta: 0.2 },
    malacca: { latitude: 2.1896, longitude: 102.2501, latDelta: 0.15, lngDelta: 0.15, aliases: ['melaka'] },
    bukitbintang: { latitude: 3.1466, longitude: 101.7108, latDelta: 0.03, lngDelta: 0.03, aliases: ['bukit bintang'] },
    klcc: { latitude: 3.1588, longitude: 101.7119, latDelta: 0.03, lngDelta: 0.03, aliases: ['petronas', 'twin towers'] },
    cameronhighlands: { latitude: 4.4718, longitude: 101.3767, latDelta: 0.15, lngDelta: 0.15, aliases: ['cameron highlands'] },
  },
  india: {
    mumbai: { latitude: 19.0760, longitude: 72.8777, latDelta: 0.3, lngDelta: 0.3, aliases: ['bombay'] },
    delhi: { latitude: 28.7041, longitude: 77.1025, latDelta: 0.3, lngDelta: 0.3, aliases: ['new delhi'] },
    bangalore: { latitude: 12.9716, longitude: 77.5946, latDelta: 0.25, lngDelta: 0.25, aliases: ['bengaluru'] },
    goa: { latitude: 15.2993, longitude: 74.1240, latDelta: 0.4, lngDelta: 0.4 },
    jaipur: { latitude: 26.9124, longitude: 75.7873, latDelta: 0.2, lngDelta: 0.2, aliases: ['pink city'] },
    agra: { latitude: 27.1767, longitude: 78.0081, latDelta: 0.15, lngDelta: 0.15, aliases: ['taj mahal'] },
    varanasi: { latitude: 25.3176, longitude: 82.9739, latDelta: 0.15, lngDelta: 0.15, aliases: ['benares'] },
    kerala: { latitude: 10.8505, longitude: 76.2711, latDelta: 1.0, lngDelta: 1.0 },
    udaipur: { latitude: 24.5854, longitude: 73.7125, latDelta: 0.15, lngDelta: 0.15 },
    rishikesh: { latitude: 30.0869, longitude: 78.2676, latDelta: 0.1, lngDelta: 0.1 },
  },
  usa: {
    newyork: { latitude: 40.7128, longitude: -74.0060, latDelta: 0.3, lngDelta: 0.3, aliases: ['new york', 'nyc', 'manhattan'] },
    losangeles: { latitude: 34.0522, longitude: -118.2437, latDelta: 0.4, lngDelta: 0.4, aliases: ['los angeles', 'la'] },
    sanfrancisco: { latitude: 37.7749, longitude: -122.4194, latDelta: 0.2, lngDelta: 0.2, aliases: ['san francisco', 'sf'] },
    lasvegas: { latitude: 36.1699, longitude: -115.1398, latDelta: 0.2, lngDelta: 0.2, aliases: ['las vegas', 'vegas'] },
    miami: { latitude: 25.7617, longitude: -80.1918, latDelta: 0.2, lngDelta: 0.2 },
    chicago: { latitude: 41.8781, longitude: -87.6298, latDelta: 0.25, lngDelta: 0.25 },
    seattle: { latitude: 47.6062, longitude: -122.3321, latDelta: 0.2, lngDelta: 0.2 },
    hawaii: { latitude: 21.3069, longitude: -157.8583, latDelta: 0.3, lngDelta: 0.3, aliases: ['honolulu', 'waikiki'] },
    boston: { latitude: 42.3601, longitude: -71.0589, latDelta: 0.2, lngDelta: 0.2 },
    austin: { latitude: 30.2672, longitude: -97.7431, latDelta: 0.2, lngDelta: 0.2 },
  },
  france: {
    paris: { latitude: 48.8566, longitude: 2.3522, latDelta: 0.15, lngDelta: 0.15 },
    nice: { latitude: 43.7102, longitude: 7.2620, latDelta: 0.1, lngDelta: 0.1 },
    lyon: { latitude: 45.7640, longitude: 4.8357, latDelta: 0.15, lngDelta: 0.15 },
    marseille: { latitude: 43.2965, longitude: 5.3698, latDelta: 0.15, lngDelta: 0.15 },
    bordeaux: { latitude: 44.8378, longitude: -0.5792, latDelta: 0.15, lngDelta: 0.15 },
    montmartre: { latitude: 48.8867, longitude: 2.3431, latDelta: 0.03, lngDelta: 0.03 },
    marais: { latitude: 48.8592, longitude: 2.3622, latDelta: 0.02, lngDelta: 0.02, aliases: ['le marais'] },
    saintgermain: { latitude: 48.8539, longitude: 2.3338, latDelta: 0.02, lngDelta: 0.02, aliases: ['saint germain', 'st germain'] },
  },
  italy: {
    rome: { latitude: 41.9028, longitude: 12.4964, latDelta: 0.15, lngDelta: 0.15, aliases: ['roma'] },
    florence: { latitude: 43.7696, longitude: 11.2558, latDelta: 0.1, lngDelta: 0.1, aliases: ['firenze'] },
    venice: { latitude: 45.4408, longitude: 12.3155, latDelta: 0.1, lngDelta: 0.1, aliases: ['venezia'] },
    milan: { latitude: 45.4642, longitude: 9.1900, latDelta: 0.15, lngDelta: 0.15, aliases: ['milano'] },
    naples: { latitude: 40.8518, longitude: 14.2681, latDelta: 0.15, lngDelta: 0.15, aliases: ['napoli'] },
    amalfi: { latitude: 40.6340, longitude: 14.6027, latDelta: 0.1, lngDelta: 0.1, aliases: ['amalfi coast'] },
    cinque: { latitude: 44.1461, longitude: 9.6439, latDelta: 0.1, lngDelta: 0.1, aliases: ['cinque terre'] },
    trastevere: { latitude: 41.8867, longitude: 12.4692, latDelta: 0.02, lngDelta: 0.02 },
  },
  spain: {
    barcelona: { latitude: 41.3851, longitude: 2.1734, latDelta: 0.15, lngDelta: 0.15 },
    madrid: { latitude: 40.4168, longitude: -3.7038, latDelta: 0.15, lngDelta: 0.15 },
    seville: { latitude: 37.3891, longitude: -5.9845, latDelta: 0.12, lngDelta: 0.12, aliases: ['sevilla'] },
    granada: { latitude: 37.1773, longitude: -3.5986, latDelta: 0.1, lngDelta: 0.1 },
    valencia: { latitude: 39.4699, longitude: -0.3763, latDelta: 0.15, lngDelta: 0.15 },
    ibiza: { latitude: 38.9067, longitude: 1.4206, latDelta: 0.15, lngDelta: 0.15 },
    mallorca: { latitude: 39.6953, longitude: 3.0176, latDelta: 0.3, lngDelta: 0.3, aliases: ['majorca', 'palma'] },
    sanSebastian: { latitude: 43.3183, longitude: -1.9812, latDelta: 0.1, lngDelta: 0.1, aliases: ['san sebastian', 'donostia'] },
  },
  uk: {
    london: { latitude: 51.5074, longitude: -0.1278, latDelta: 0.2, lngDelta: 0.2 },
    edinburgh: { latitude: 55.9533, longitude: -3.1883, latDelta: 0.12, lngDelta: 0.12 },
    manchester: { latitude: 53.4808, longitude: -2.2426, latDelta: 0.15, lngDelta: 0.15 },
    liverpool: { latitude: 53.4084, longitude: -2.9916, latDelta: 0.12, lngDelta: 0.12 },
    oxford: { latitude: 51.7520, longitude: -1.2577, latDelta: 0.1, lngDelta: 0.1 },
    cambridge: { latitude: 52.2053, longitude: 0.1218, latDelta: 0.1, lngDelta: 0.1 },
    soho: { latitude: 51.5137, longitude: -0.1337, latDelta: 0.02, lngDelta: 0.02 },
    shoreditch: { latitude: 51.5246, longitude: -0.0760, latDelta: 0.02, lngDelta: 0.02 },
    camden: { latitude: 51.5390, longitude: -0.1426, latDelta: 0.03, lngDelta: 0.03 },
    notting: { latitude: 51.5090, longitude: -0.1963, latDelta: 0.02, lngDelta: 0.02, aliases: ['notting hill'] },
  },
  australia: {
    sydney: { latitude: -33.8688, longitude: 151.2093, latDelta: 0.25, lngDelta: 0.25 },
    melbourne: { latitude: -37.8136, longitude: 144.9631, latDelta: 0.25, lngDelta: 0.25 },
    brisbane: { latitude: -27.4698, longitude: 153.0251, latDelta: 0.2, lngDelta: 0.2 },
    perth: { latitude: -31.9505, longitude: 115.8605, latDelta: 0.25, lngDelta: 0.25 },
    goldcoast: { latitude: -28.0167, longitude: 153.4000, latDelta: 0.2, lngDelta: 0.2, aliases: ['gold coast'] },
    cairns: { latitude: -16.9186, longitude: 145.7781, latDelta: 0.15, lngDelta: 0.15 },
    bondi: { latitude: -33.8914, longitude: 151.2767, latDelta: 0.03, lngDelta: 0.03, aliases: ['bondi beach'] },
    surfers: { latitude: -28.0024, longitude: 153.4310, latDelta: 0.03, lngDelta: 0.03, aliases: ['surfers paradise'] },
  },
};

// Country center coordinates
const COUNTRY_COORDS: Record<string, { latitude: number; longitude: number; latDelta: number; lngDelta: number }> = {
  japan: { latitude: 36.2048, longitude: 138.2529, latDelta: 10, lngDelta: 10 },
  thailand: { latitude: 15.8700, longitude: 100.9925, latDelta: 12, lngDelta: 8 },
  korea: { latitude: 35.9078, longitude: 127.7669, latDelta: 5, lngDelta: 4 },
  vietnam: { latitude: 14.0583, longitude: 108.2772, latDelta: 12, lngDelta: 8 },
  singapore: { latitude: 1.3521, longitude: 103.8198, latDelta: 0.5, lngDelta: 0.5 },
  indonesia: { latitude: -0.7893, longitude: 113.9213, latDelta: 20, lngDelta: 25 },
  malaysia: { latitude: 4.2105, longitude: 101.9758, latDelta: 10, lngDelta: 10 },
  india: { latitude: 20.5937, longitude: 78.9629, latDelta: 20, lngDelta: 20 },
  china: { latitude: 35.8617, longitude: 104.1954, latDelta: 25, lngDelta: 30 },
  usa: { latitude: 37.0902, longitude: -95.7129, latDelta: 30, lngDelta: 50 },
  france: { latitude: 46.2276, longitude: 2.2137, latDelta: 8, lngDelta: 8 },
  italy: { latitude: 41.8719, longitude: 12.5674, latDelta: 8, lngDelta: 6 },
  spain: { latitude: 40.4637, longitude: -3.7492, latDelta: 8, lngDelta: 10 },
  uk: { latitude: 55.3781, longitude: -3.4360, latDelta: 10, lngDelta: 8 },
  australia: { latitude: -25.2744, longitude: 133.7751, latDelta: 30, lngDelta: 35 },
  default: { latitude: 20, longitude: 0, latDelta: 60, lngDelta: 60 },
};

const COUNTRY_FLAGS: Record<string, string> = {
  japan: '🇯🇵', korea: '🇰🇷', thailand: '🇹🇭', vietnam: '🇻🇳', singapore: '🇸🇬',
  indonesia: '🇮🇩', malaysia: '🇲🇾', india: '🇮🇳', china: '🇨🇳', usa: '🇺🇸',
  france: '🇫🇷', italy: '🇮🇹', spain: '🇪🇸', uk: '🇬🇧', australia: '🇦🇺',
};

const CATEGORY_COLORS: Record<string, string> = {
  food: '#22C55E',        // Emerald Green
  activity: '#06B6D4',    // Electric Cyan
  shopping: '#EAB308',    // Golden Yellow
  accommodation: '#F43F5E', // Rose Red
  place: '#6366F1',       // Indigo
  tip: '#EC4899',         // Pink
  nightlife: '#F97316',   // Orange
  default: '#06B6D4',     // Cyan
};

const SUBCATEGORY_COLORS: ('green' | 'blue' | 'yellow' | 'purple' | 'pink' | 'orange')[] = [
  'green', 'blue', 'pink', 'orange', 'purple', 'yellow'
];

// Category Filter Chips Configuration
type CategoryFilterType = 'all' | 'food' | 'activity' | 'place' | 'shopping' | 'nightlife' | 'accommodation';

interface CategoryFilterConfig {
  key: CategoryFilterType;
  label: string;
  icon: string;
  color: string;  // Hex color for chips and clusters when filtered
}

const CATEGORY_FILTERS: CategoryFilterConfig[] = [
  { key: 'all', label: 'All', icon: '🌍', color: '#06B6D4' },
  { key: 'food', label: 'Food', icon: '🍔', color: '#22C55E' },
  { key: 'activity', label: 'Activity', icon: '🎯', color: '#06B6D4' },
  { key: 'place', label: 'Place', icon: '📍', color: '#6366F1' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️', color: '#EAB308' },
  { key: 'nightlife', label: 'Nightlife', icon: '🎉', color: '#EC4899' },
  { key: 'accommodation', label: 'Stay', icon: '🏨', color: '#F43F5E' },
];

// Mapbox style - navigation night for dark Zenly aesthetic
const MAPBOX_STYLE = 'mapbox://styles/mapbox/navigation-night-v1';

type ViewMode = 'macro' | 'micro';
type FilterMode = 'all' | 'nearMe' | 'area';

interface RouteParams {
  tripId: string;
  countryName: string;
  discoveryIntent?: any;
  scoutResults?: any[];
}

interface BubbleData {
  id: string;
  label: string;
  count: number;
  color: 'green' | 'blue' | 'yellow' | 'purple' | 'pink' | 'orange';
  position: { x: number; y: number };
  items: SavedItem[];
  category?: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get canonical country key for CITY_COORDS
 */
function getCountryKey(countryName: string): string {
  const name = countryName.toLowerCase();
  if (name === 'united states' || name === 'usa' || name === 'us') return 'usa';
  if (name === 'united kingdom' || name === 'uk' || name === 'gb') return 'uk';
  if (name === 'south korea' || name === 'korea') return 'korea';
  return name.replace(/\s+/g, '');
}

/**
 * Check if GPS coordinates are within a country's bounds
 */
function isInCountry(lat: number, lng: number, countryName: string): boolean {
  const bounds = COUNTRY_BOUNDS[getCountryKey(countryName)];
  if (!bounds) return false;
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
}

/**
 * Calculate distance between two points in km (Haversine formula)
 */
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Convert km to approximate lat/lng delta
 */
function kmToLatDelta(km: number): number {
  return km / 111; // ~111km per degree of latitude
}

/**
 * Filter items within a radius (in km) of a point
 */
function filterItemsByRadius(items: SavedItem[], lat: number, lng: number, radiusKm: number): SavedItem[] {
  return items.filter(item => {
    if (!item.location_lat || !item.location_lng) return false;
    const distance = getDistanceKm(lat, lng, item.location_lat, item.location_lng);
    return distance <= radiusKm;
  });
}

/**
 * Filter items to keep only unique places
 * Logic: Match by google_place_id OR (name AND coordinate match)
 */
function filterUniqueItems(items: SavedItem[]): SavedItem[] {
  const seen = new Set<string>();
  const uniqueItems: SavedItem[] = [];

  items.forEach(item => {
    // Priority 1: Google Place ID
    if (item.google_place_id) {
      if (!seen.has(item.google_place_id)) {
        seen.add(item.google_place_id);
        uniqueItems.push(item);
      }
      return;
    }

    // Priority 2: Name + Approx Coordinate (to catch duplicates without Google IDs)
    const nameKey = item.name?.toLowerCase().trim() || 'unknown';
    const lat = item.location_lat ? Number(item.location_lat).toFixed(4) : '0';
    const lng = item.location_lng ? Number(item.location_lng).toFixed(4) : '0';
    const geoKey = `${nameKey}_${lat}_${lng}`;

    if (!seen.has(geoKey)) {
      seen.add(geoKey);
      uniqueItems.push(item);
    }
  });

  return uniqueItems;
}

/**
 * Filter items within visible map bounds
 */
function filterItemsByMapBounds(items: SavedItem[], bounds: number[][]): SavedItem[] {
  if (!bounds || bounds.length !== 2) return items;
  
  // Mapbox returns [[neLng, neLat], [swLng, swLat]]
  const [ne, sw] = bounds;
  const neLng = ne[0], neLat = ne[1];
  const swLng = sw[0], swLat = sw[1];
  
  // Calculate actual min/max to handle any format
  const minLat = Math.min(neLat, swLat);
  const maxLat = Math.max(neLat, swLat);
  const minLng = Math.min(neLng, swLng);
  const maxLng = Math.max(neLng, swLng);
  
  return items.filter(item => {
    if (!item.location_lat || !item.location_lng) return false;
    const lat = Number(item.location_lat);
    const lng = Number(item.location_lng);
    
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  });
}

// Minimum zoom level to activate map-based filtering (5 = city level)
const MIN_ZOOM_FOR_FILTERING = 5;

/**
 * Calculate bounding box from a list of items
 * Returns center coordinates and appropriate zoom level
 */
function calculateBoundsFromItems(items: SavedItem[]): { 
  center: [number, number]; 
  zoomLevel: number;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
} {
  const itemsWithCoords = items.filter(item => item.location_lat && item.location_lng);
  
  if (itemsWithCoords.length === 0) {
    return { center: [0, 0], zoomLevel: 2, bounds: null };
  }
  
  if (itemsWithCoords.length === 1) {
    const item = itemsWithCoords[0];
    return { 
      center: [item.location_lng!, item.location_lat!], 
      zoomLevel: 14,
      bounds: { minLat: item.location_lat!, maxLat: item.location_lat!, minLng: item.location_lng!, maxLng: item.location_lng! }
    };
  }
  
  // Calculate bounds
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  itemsWithCoords.forEach(item => {
    const lat = item.location_lat!;
    const lng = item.location_lng!;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  });
  
  // Calculate center
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  
  // Calculate zoom level to fit all points
  // Add padding (20% on each side)
  const latDelta = (maxLat - minLat) * 1.4;
  const lngDelta = (maxLng - minLng) * 1.4;
  const maxDelta = Math.max(latDelta, lngDelta, 0.01); // Minimum delta to avoid infinite zoom
  
  // zoom = log2(360 / delta) - approximation
  const zoomLevel = Math.min(Math.max(Math.log2(360 / maxDelta) - 1, 2), 16);
  
  return { 
    center: [centerLng, centerLat], 
    zoomLevel,
    bounds: { minLat, maxLat, minLng, maxLng }
  };
}

/**
 * Filter items by location name/area match + proximity
 */
function filterItemsByLocation(items: SavedItem[], location: string, coords: CityCoords): SavedItem[] {
  const locationLower = location.toLowerCase();
  
  return items.filter(item => {
    if (item.area_name) {
      const areaLower = item.area_name.toLowerCase();
      if (areaLower.includes(locationLower) || locationLower.includes(areaLower)) return true;
    }
    if (item.location_name) {
      const locNameLower = item.location_name.toLowerCase();
      if (locNameLower.includes(locationLower)) return true;
    }
    if (item.location_lat && item.location_lng) {
      const distance = getDistanceKm(coords.latitude, coords.longitude, item.location_lat, item.location_lng);
      const radiusKm = Math.max(coords.latDelta, coords.lngDelta) * 50;
      if (distance <= radiusKm) return true;
    }
    return false;
  });
}

/**
 * Detect location query from message
 */
function detectLocationQuery(message: string, countryName: string): { isLocationQuery: boolean; location: string | null; coords: CityCoords | null; radiusKm?: number } {
  const lowerMessage = message.toLowerCase().trim();
  const countryKey = getCountryKey(countryName);
  
  // Check for reset commands
  const resetPhrases = ['show everything', 'show all', 'all places', 'entire country', 'whole country', 'reset', 'zoom out', 'back to all'];
  if (resetPhrases.some(phrase => lowerMessage.includes(phrase))) {
    return { isLocationQuery: true, location: null, coords: null };
  }
  
  // Check for radius commands (e.g., "10km", "20 km", "within 15km")
  const radiusMatch = lowerMessage.match(/(\d+)\s*km/);
  if (radiusMatch) {
    const radiusKm = parseInt(radiusMatch[1], 10);
    return { isLocationQuery: true, location: 'custom', coords: null, radiusKm };
  }
  
  // Check for expand commands
  if (lowerMessage.includes('expand') || lowerMessage.includes('wider') || lowerMessage.includes('more area')) {
    return { isLocationQuery: true, location: 'expand', coords: null };
  }
  
  // Check for "near me" commands
  const nearMePhrases = ['near me', 'nearby', 'around me', 'my location', 'where i am'];
  if (nearMePhrases.some(phrase => lowerMessage.includes(phrase))) {
    return { isLocationQuery: true, location: 'nearMe', coords: null };
  }
  
  // Location trigger phrases
  const locationTriggers = ['take me to', 'show me', 'go to', 'places in', 'spots in', 'food in', 'things in', 'what\'s in', 'whats in', 'explore', 'visit', 'around', 'near', 'in the', 'at the'];
  const hasLocationTrigger = locationTriggers.some(trigger => lowerMessage.includes(trigger));
  
  // Try to match a city/area
  const countryCities = CITY_COORDS[countryKey] || {};
  for (const [cityKey, cityData] of Object.entries(countryCities)) {
    const searchTerms = [cityKey, ...(cityData.aliases || [])];
    for (const term of searchTerms) {
      if (lowerMessage.includes(term.toLowerCase())) {
        const displayName = cityKey.charAt(0).toUpperCase() + cityKey.slice(1);
        return { isLocationQuery: true, location: displayName, coords: cityData };
      }
    }
  }
  
  if (hasLocationTrigger) {
    return { isLocationQuery: true, location: null, coords: null };
  }
  
  return { isLocationQuery: false, location: null, coords: null };
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function CountryBubbleScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const cameraRef = useRef<Camera>(null);
  const isClusterAnimatingRef = useRef(false); // Prevent rapid cluster taps
  
  const params = route.params || {};
  const tripId = params.tripId || '';
  const countryName = params.countryName || 'Unknown';

  // Data state
  const [isLoading, setIsLoading] = useState(true);
  const [allItems, setAllItems] = useState<SavedItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<SavedItem[]>([]);
  const [subClusters, setSubClusters] = useState<SubClusters | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('macro');
  // selectedCategory state REMOVED - no longer using orbital bubbles

  // Filter state
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [activeAreaFilter, setActiveAreaFilter] = useState<string | null>(null);
  const [activeAreaCoords, setActiveAreaCoords] = useState<CityCoords | null>(null);
  const [currentRadiusKm, setCurrentRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [userInCountry, setUserInCountry] = useState<boolean>(false);
  const [hasAutoFocused, setHasAutoFocused] = useState<boolean>(false);
  
  // NEW: Discovery Intent (Scout Mode)
  const [discoveryIntent, setDiscoveryIntent] = useState<any>((params as any).discoveryIntent || null);
  const [scoutResults, setScoutResults] = useState<any[]>((params as any).scoutResults || []);
  const [scoutId, setScoutId] = useState<string | null>((params as any).scoutId || null);
  const [isScoutCarouselVisible, setIsScoutCarouselVisible] = useState(false);
  
  // Category filter state (for chip filtering)
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterType>('all');
  
  // Map bounds filtering state
  const [currentZoom, setCurrentZoom] = useState<number>(0);
  const mapFilterTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Visible items for drawer (filtered by map bounds) - "Mini-map inventory"
  const [drawerItems, setDrawerItems] = useState<SavedItem[]>([]);
  const mapViewRef = useRef<MapView>(null);

  // Compact Chat state
  const [isCompactChatOpen, setIsCompactChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAITyping, setIsAITyping] = useState(false);

  // Bottom Sheet State (Clusters/Pins use this)
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [bottomSheetItems, setBottomSheetItems] = useState<SavedItem[]>([]);
  const [bottomSheetLabel, setBottomSheetLabel] = useState('');
  const [bottomSheetEmoji, setBottomSheetEmoji] = useState('📍');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>(undefined);
  const bottomSheetRef = useRef<GameBottomSheetRef>(null);
  const placeDetailSheetRef = useRef<PlaceDetailSheetRef>(null);
  const placesDrawerRef = useRef<PersistentPlacesDrawerRef>(null);

  // Check if single place detail sheet is open (used to hide persistent drawer)
  const isSinglePlaceDetailOpen = bottomSheetVisible && bottomSheetItems.length === 1;
  
  // Refs for checking state in callbacks (avoids stale closure issue)
  // These are updated IMMEDIATELY in handlers, not via useEffect (which is async)
  const isInRPGFlowRef = useRef<boolean>(false);
  const selectedPlaceIdRef = useRef<string | undefined>(undefined);

  // Stores
  const { sendQuery, isLoading: companionLoading, getMessages } = useCompanionStore();
  const { location, startTracking } = useLocationStore();

  const countryKey = getCountryKey(countryName);
  const countryCoords = COUNTRY_COORDS[countryKey] || COUNTRY_COORDS.default;
  const countryFlag = COUNTRY_FLAGS[countryKey] || '🌍';
  const countryBounds = COUNTRY_BOUNDS[countryKey];
  
  // Calculate category counts for chips (based on drawerItems = visible in map view)
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilterType, number> = {
      all: drawerItems.length,
      food: 0,
      activity: 0,
      place: 0,
      shopping: 0,
      nightlife: 0,
      accommodation: 0,
    };
    
    drawerItems.forEach(item => {
      const category = (item.category?.toLowerCase() || 'place') as CategoryFilterType;
      if (counts[category] !== undefined) {
        counts[category]++;
      } else {
        // Unknown categories default to 'place'
        counts.place++;
      }
    });
    
    return counts;
  }, [drawerItems]);
  
  // Apply category filter on top of location-based filtering
  const categoryFilteredItems = useMemo(() => {
    if (selectedCategory === 'all') {
      return filteredItems;
    }
    return filteredItems.filter(item => {
      const itemCategory = item.category?.toLowerCase() || 'place';
      return itemCategory === selectedCategory;
    });
  }, [filteredItems, selectedCategory]);
  
  // Use category-filtered items for map display
  const items = categoryFilteredItems;

  // Keep a ref of items for the map sync callback to avoid staleness/re-renders
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  
  // Get current category color for clusters (when filtered)
  const currentCategoryColor = useMemo(() => {
    if (selectedCategory === 'all') return null;
    const config = CATEGORY_FILTERS.find(c => c.key === selectedCategory);
    return config?.color || '#8B5CF6';
  }, [selectedCategory]);
  
  // Get current category config for the persistent drawer
  const currentCategoryConfig = useMemo(() => {
    const config = CATEGORY_FILTERS.find(c => c.key === selectedCategory);
    return config || CATEGORY_FILTERS[0]; // Default to 'All'
  }, [selectedCategory]);

  // RPG CAMERA FIX - Use ref-only approach to avoid state/ref fighting
  // Initial camera position (only used on first render)
  const initialCameraConfig = useMemo(() => ({
    centerCoordinate: [countryCoords.longitude, countryCoords.latitude] as [number, number],
    zoomLevel: Math.log2(360 / Math.max(countryCoords.latDelta, 0.01)),
  }), [countryCoords]);
  
  // Ref to track current zoom for callbacks (avoids stale closure)
  const currentZoomRef = useRef(initialCameraConfig.zoomLevel);
  
  // Helper function for camera animations (replaces setCameraConfig)
  const flyToCamera = useCallback((options: {
    center: [number, number];
    zoom?: number;
    pitch?: number;
    heading?: number;
    duration?: number;
    mode?: 'flyTo' | 'easeTo' | 'linearTo';
  }) => {
    if (!cameraRef.current) {
      console.log('⚠️ Camera ref not ready');
      return;
    }
    
    // Use requestAnimationFrame to ensure touch event is finished
    requestAnimationFrame(() => {
      cameraRef.current?.setCamera({
        centerCoordinate: options.center,
        zoomLevel: options.zoom ?? currentZoomRef.current,
        pitch: options.pitch ?? 0,
        heading: options.heading ?? 0,
        animationDuration: options.duration ?? 800,
        animationMode: options.mode ?? 'flyTo',
      });
    });
  }, []);

  // Start location tracking
  useEffect(() => {
    startTracking();
  }, []);

  // Set initial welcome message
  useEffect(() => {
    setChatMessages([{
      id: 'welcome',
      type: 'ai',
      content: `Hey! 👋 I'm your travel buddy for ${countryName}.\n\nTry: "Take me to ${countryName === 'Japan' ? 'Shibuya' : countryName === 'Thailand' ? 'Bangkok' : 'the city'}" or "Near me"`,
      timestamp: new Date(),
    }]);
  }, [countryName]);

  // Fetch data
  useEffect(() => {
    if (tripId) {
      fetchItems();
    } else {
      setIsLoading(false);
    }
  }, [tripId]);

  const handleScoutSelect = async (scout: ScoutResult) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setIsScoutCarouselVisible(false);
      setIsLoading(true);

      // Save the scouted place to the trip
      const response = await api.post(`/trips/${tripId}/items`, {
        name: scout.name,
        category: 'food', // Default to food for now, scout results usually have more detail
        description: scout.generative_summary || `Found via AI scouting for ${discoveryIntent?.item}`,
        locationName: scout.address,
        locationLat: scout.location.lat,
        locationLng: scout.location.lng,
        googlePlaceId: scout.place_id,
        rating: scout.rating,
        userRatingsTotal: scout.user_rating_count,
        photosJson: scout.photos,
        cuisineType: discoveryIntent?.type === 'CULINARY_GOAL' ? discoveryIntent.item : undefined,
        destination: discoveryIntent?.city,
        sourceTitle: `AI Scout: ${discoveryIntent?.item}`,
        originalSourceType: 'web',
      });

      if (response.data) {
        // Mark the scout intent as resolved if we have an ID
        if (scoutId) {
          try {
            await api.patch(`/share/scouts/${scoutId}/status`, { status: 'resolved' });
            setDiscoveryIntent(null);
            setScoutId(null);
          } catch (e) {
            console.error('[Scout] Failed to resolve scout status:', e);
          }
        }

        // Refresh items
        await fetchItems();
        
        // Show success
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error saving scouted place:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchItems = async () => {
    if (!tripId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const itemsResponse = await api.get(`/trips/${tripId}/items`);
      const fetchedItems: SavedItem[] = itemsResponse.data.data || itemsResponse.data || [];
      
      // Filter for unique items before setting state
      const uniqueItems = filterUniqueItems(fetchedItems);
      console.log(`📦 Fetched ${fetchedItems.length} items, filtered to ${uniqueItems.length} unique places`);
      
      setAllItems(uniqueItems);
      setFilteredItems(uniqueItems);

      // FIX: Center camera on actual places, not default country coords
      if (uniqueItems.length > 0) {
        const { center, zoomLevel } = calculateBoundsFromItems(uniqueItems);
        console.log(`📍 Centering on ${uniqueItems.length} places: [${center[0].toFixed(2)}, ${center[1].toFixed(2)}] zoom ${zoomLevel.toFixed(1)}`);
        // Use timeout to ensure camera ref is ready after initial render
        setTimeout(() => {
          flyToCamera({
            center,
            zoom: zoomLevel,
            duration: 1000,
            mode: 'easeTo',
          });
        }, 100);
      }

      try {
        const clustersResponse = await api.get(`/trips/${tripId}/items/sub-clusters`);
        setSubClusters(clustersResponse.data.data || clustersResponse.data);
      } catch (e) {
        setSubClusters(null);
      }

      // Also fetch active scouts for this trip
      try {
        const scoutsResponse = await api.get(`/share/scouts/${tripId}`);
        if (scoutsResponse.data.success && scoutsResponse.data.scouts?.length > 0) {
          // For now, let's just use the most recent active scout
          const activeScout = scoutsResponse.data.scouts[0];
          setDiscoveryIntent(activeScout.intent);
          setScoutResults(activeScout.results || []);
          setScoutId(activeScout.id);
          console.log(`🔍 [Scout] Loaded active scout: ${activeScout.intent.item}`);
        }
      } catch (scoutError) {
        console.error('Error fetching active scouts:', scoutError);
      }
    } catch (error) {
      console.error('[CountryBubbles] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-focus to user location if in country
  useEffect(() => {
    if (!isLoading && allItems.length > 0 && location && !hasAutoFocused) {
      const userLat = location.coords.latitude;
      const userLng = location.coords.longitude;
      
      if (isInCountry(userLat, userLng, countryName)) {
        setUserInCountry(true);
        setHasAutoFocused(true);
        
        // Apply "near me" filter
        applyNearMeFilter(userLat, userLng);
        
        // Add message about auto-focus
        setChatMessages(prev => [...prev, {
          id: `auto-${Date.now()}`,
          type: 'ai',
          content: `📍 You're in ${countryName}! Showing places near you.`,
          timestamp: new Date(),
        }]);
      } else {
        setHasAutoFocused(true);
      }
    }
  }, [isLoading, allItems, location, hasAutoFocused, countryName]);

  // ============================================================
  // FILTER HANDLERS
  // ============================================================

  const animateToRegion = useCallback((lat: number, lng: number, latDelta: number, lngDelta: number) => {
    // Convert latDelta to zoom level (approximate)
    // zoom = log2(360 / latDelta)
    const zoomLevel = Math.log2(360 / Math.max(latDelta, 0.01));
    
    // Use ref-based camera for smooth animations
    flyToCamera({
      center: [lng, lat],
      zoom: Math.min(Math.max(zoomLevel, 1), 18),
      pitch: 0,
      duration: 800,
      mode: 'flyTo',
    });
  }, [flyToCamera]);

  const applyNearMeFilter = useCallback((lat: number, lng: number, radiusKm: number = DEFAULT_RADIUS_KM) => {
    // Filter items within radius
    let nearbyItems = filterItemsByRadius(allItems, lat, lng, radiusKm);
    
    // If too few items, expand radius
    if (nearbyItems.length < MIN_PLACES_THRESHOLD && radiusKm < EXPANDED_RADIUS_KM) {
      nearbyItems = filterItemsByRadius(allItems, lat, lng, EXPANDED_RADIUS_KM);
      setCurrentRadiusKm(EXPANDED_RADIUS_KM);
    } else {
      setCurrentRadiusKm(radiusKm);
    }
    
    setFilterMode('nearMe');
    setActiveAreaFilter('Near You');
    setActiveAreaCoords(null);
    setFilteredItems(nearbyItems);
    setViewMode('macro');
    // setSelectedCategory REMOVED - no longer using orbital bubbles
    
    // Animate map
    const delta = kmToLatDelta(radiusKm < EXPANDED_RADIUS_KM && nearbyItems.length < MIN_PLACES_THRESHOLD ? EXPANDED_RADIUS_KM : radiusKm);
    animateToRegion(lat, lng, delta, delta);
  }, [allItems, animateToRegion]);

  const applyAreaFilter = useCallback((locationName: string, coords: CityCoords) => {
    setFilterMode('area');
    setActiveAreaFilter(locationName);
    setActiveAreaCoords(coords);
    setCurrentRadiusKm(Math.max(coords.latDelta, coords.lngDelta) * 50);
    
    const filtered = filterItemsByLocation(allItems, locationName, coords);
    setFilteredItems(filtered);
    setViewMode('macro');
    // setSelectedCategory REMOVED - no longer using orbital bubbles
    
    animateToRegion(coords.latitude, coords.longitude, coords.latDelta, coords.lngDelta);
  }, [allItems, animateToRegion]);

  const resetToCountryView = useCallback(() => {
    setFilterMode('all');
    setActiveAreaFilter(null);
    setActiveAreaCoords(null);
    setCurrentRadiusKm(DEFAULT_RADIUS_KM);
    setFilteredItems(allItems);
    setViewMode('macro');
    // setSelectedCategory REMOVED - no longer using orbital bubbles
    
    animateToRegion(countryCoords.latitude, countryCoords.longitude, countryCoords.latDelta, countryCoords.lngDelta);
  }, [allItems, countryCoords, animateToRegion]);

  // Calculate distance between two coordinates in meters (Haversine formula)
  const getDistanceMeters = useCallback((coord1: [number, number], coord2: [number, number]): number => {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;
    
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) ** 2 + 
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLng / 2) ** 2;
    
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // Check if camera has moved away from hero (called on region change)
  const checkIfPannedAway = useCallback((centerCoords: [number, number]) => {
    if (!heroCoordinatesRef.current || !bottomSheetVisible) return;
    
    const distance = getDistanceMeters(centerCoords, heroCoordinatesRef.current);
    
    // Show re-center button if more than 300m away
    if (distance > 300) {
      setShowRecenter(true);
    } else {
      setShowRecenter(false);
    }
  }, [bottomSheetVisible, getDistanceMeters]);

  // Generate GeoJSON for Discovery Intent (Ghost Pin)
  const discoveryGeoJSON = useMemo(() => {
    if (!discoveryIntent?.city) return null;
    
    // Find city coordinates - robust lookup
    const searchCity = discoveryIntent.city.toLowerCase().trim();
    const countryKey = getCountryKey(countryName);
    const countryCities = CITY_COORDS[countryKey] || {};
    
    let cityData: CityCoords | null = null;
    
    // 1. Try direct key match (e.g. "seoul")
    const cityKey = searchCity.replace(/\s+/g, '');
    if (countryCities[cityKey]) {
      cityData = countryCities[cityKey];
    } else {
      // 2. Try alias match (e.g. "jeju island" -> "jeju")
      for (const [key, data] of Object.entries(countryCities)) {
        const matchFound = 
          key === searchCity || 
          data.aliases?.some(alias => searchCity.includes(alias.toLowerCase()) || alias.toLowerCase().includes(searchCity));
        
        if (matchFound) {
          cityData = data;
          break;
        }
      }
    }
    
    if (!cityData) {
      console.warn(`⚠️ [Scout] Map couldn't find coordinates for city: "${discoveryIntent.city}" in ${countryName}`);
      return null;
    }

    console.log(`📍 [Scout] Ghost Pin location found: ${discoveryIntent.city} at [${cityData.longitude}, ${cityData.latitude}]`);
    
    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        id: 'ghost-pin',
        geometry: {
          type: 'Point' as const,
          coordinates: [cityData.longitude, cityData.latitude],
        },
        properties: {
          name: discoveryIntent.item,
          type: 'ghost',
        }
      }]
    };
  }, [discoveryIntent, countryName]);

  // Handle map idle (when user stops panning/zooming)
  // Updates drawer items based on what's visible on screen
  const handleMapIdle = useCallback((event: any) => {
    // 1. Extract zoom and bounds from the event (Push model)
    const zoom = event.properties?.zoomLevel 
      || event.properties?.zoom 
      || event?.zoomLevel 
      || event?.zoom 
      || 10;
    
    const eventBounds = event.properties?.visibleBounds;
    
    console.log('🗺️ Map idle - zoom:', zoom.toFixed(2));
    setCurrentZoom(zoom);
    currentZoomRef.current = zoom;
    
    // Unlock cluster animation when map settles
    if (isClusterAnimatingRef.current) {
      isClusterAnimatingRef.current = false;
    }

    // 2. Sync drawer with bounds using a small delay (let JS breathe)
    // This prevents the "racing" effect during fast pans/zooms
    if (mapFilterTimeoutRef.current) {
      clearTimeout(mapFilterTimeoutRef.current);
    }

    mapFilterTimeoutRef.current = setTimeout(async () => {
      let visibleBounds = eventBounds;

      // Fallback to imperative call if bounds not in event
      if (!visibleBounds && mapViewRef.current) {
        try {
          visibleBounds = await mapViewRef.current.getVisibleBounds();
        } catch (error) {
          console.log('⚠️ getVisibleBounds failed:', error);
        }
      }

      // Update drawer items based on what's actually visible
      if (visibleBounds && Array.isArray(visibleBounds) && visibleBounds.length === 2) {
        // Filter against itemsRef to ensure we have the latest category-filtered list
        const boundsFiltered = filterItemsByMapBounds(itemsRef.current, visibleBounds);
        
        // Only update if the result is actually different (visual stability)
        setDrawerItems(boundsFiltered);
        console.log(`📋 Drawer sync: ${boundsFiltered.length}/${itemsRef.current.length} places in view`);
      } else {
        setDrawerItems(itemsRef.current);
      }
    }, 50);

    // 3. Check if user has panned away from hero building (for re-center button)
    if (heroCoordinatesRef.current && event.geometry?.coordinates) {
      const centerCoords = event.geometry.coordinates as [number, number];
      checkIfPannedAway(centerCoords);
    }
  }, [checkIfPannedAway]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (mapFilterTimeoutRef.current) {
        clearTimeout(mapFilterTimeoutRef.current);
      }
    };
  }, []);
  
  // Initialize drawer items when items change (category filter or data load)
  // This ensures drawer has data before first map idle event
  useEffect(() => {
    setDrawerItems(items);
    console.log(`📋 Drawer initialized: ${items.length} items`);
  }, [items]);

  // Handle category chip tap
  const handleCategorySelect = useCallback((category: CategoryFilterType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(category);
    console.log(`🏷️ Category filter: ${category}`);
  }, []);

  const handleNearMePress = useCallback(() => {
    if (!location) {
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'ai',
        content: "📍 Can't get your location. Please enable GPS.",
        timestamp: new Date(),
      }]);
      return;
    }
    
    const inCountry = isInCountry(location.coords.latitude, location.coords.longitude, countryName);
    if (!inCountry) {
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'ai',
        content: `✈️ You're not in ${countryName} yet!\n\n"Near Me" works when you're traveling there. Try exploring specific areas like "${countryName === 'Japan' ? 'Shibuya' : countryName === 'Thailand' ? 'Bangkok' : 'the city center'}".`,
        timestamp: new Date(),
      }]);
      // Open chat so user sees the message
      setIsCompactChatOpen(true);
      return;
    }
    
    applyNearMeFilter(location.coords.latitude, location.coords.longitude);
  }, [location, applyNearMeFilter, countryName]);

  // ============================================================
  // GEOJSON CLUSTER GENERATION (Replaced bubbles)
  // ============================================================

  // Category emoji icons for UI (drawer, HUD)
  const CATEGORY_ICONS: Record<string, string> = useMemo(() => ({
    food: '🍔',
    activity: '🎯',
    place: '📍',
    shopping: '🛍️',
    nightlife: '🎉',
    accommodation: '🏨',
    default: '📍',
  }), []);

  // Remote PNG icons for map pins (white icons from icons8)
  const PIN_ICONS = useMemo(() => ({
    'icon-food': { uri: 'https://img.icons8.com/ios-filled/50/FFFFFF/restaurant.png' },
    'icon-activity': { uri: 'https://img.icons8.com/ios-filled/50/FFFFFF/star--v1.png' },
    'icon-shopping': { uri: 'https://img.icons8.com/ios-filled/50/FFFFFF/shopping-bag.png' },
    'icon-nightlife': { uri: 'https://img.icons8.com/ios-filled/50/FFFFFF/wine-glass.png' },
    'icon-accommodation': { uri: 'https://img.icons8.com/ios-filled/50/FFFFFF/bedroom.png' },
    'icon-place': { uri: 'https://img.icons8.com/ios-filled/50/FFFFFF/marker.png' },
  }), []);

  // Map category to icon name
  const ICON_NAMES: Record<string, string> = useMemo(() => ({
    food: 'icon-food',
    activity: 'icon-activity',
    place: 'icon-place',
    shopping: 'icon-shopping',
    nightlife: 'icon-nightlife',
    accommodation: 'icon-accommodation',
    default: 'icon-place',
  }), []);

  // Generate GeoJSON FeatureCollection for clustering
  const placesGeoJSON = useMemo(() => {
    const features = items
      .filter(item => item.location_lat && item.location_lng)
      .map(item => {
        const rating = parseFloat(String(item.rating)) || 0;
        // Priority Score (Rank): (Rating * 10)
        // This ensures the "best" places stay visible when zoomed out
        const rank = Math.round(rating * 10);

        return {
          type: 'Feature' as const,
          id: item.id,
          geometry: {
            type: 'Point' as const,
            coordinates: [item.location_lng!, item.location_lat!],
          },
          properties: {
            id: item.id,
            name: item.name || 'Unknown Place',
            category: item.category || 'place',
            subcategory: item.cuisine_type || item.place_type || 'other',
            rating: rating,
            icon: CATEGORY_ICONS[item.category || 'place'] || CATEGORY_ICONS.default,
            iconName: ICON_NAMES[item.category || 'place'] || ICON_NAMES.default,
            color: CATEGORY_COLORS[item.category || 'place'] || CATEGORY_COLORS.default,
            rank: rank,
          },
        };
      });

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [items]);

  // Get cluster color based on dominant category in cluster
  const getClusterColor = useCallback((category: string) => {
    return CATEGORY_COLORS[category] || '#8B5CF6';
  }, []);

  // Ref for ShapeSource to access cluster methods
  const shapeSourceRef = useRef<any>(null);

  // ============================================================
  // HANDLERS
  // ============================================================

  // Handle cluster tap - RPG "Deep Dive" with getClusterExpansionZoom()
  // Uses Mapbox's native cluster expansion for perfect zoom levels
  const handleClusterPress = useCallback(async (feature: any) => {
    // Prevent rapid tapping during animation
    if (isClusterAnimatingRef.current) {
      console.log('⏳ Animation in progress, ignoring tap');
      return;
    }
    
    const coordinates = feature.geometry?.coordinates as [number, number];
    const pointCount = feature.properties?.point_count || 0;
    const clusterId = feature.properties?.cluster_id;
    
    if (!coordinates) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log(`📍 Cluster tapped: ${pointCount} places, cluster_id: ${clusterId}`, coordinates);
    
    // Lock animation
    isClusterAnimatingRef.current = true;
    
    // RPG FIX: Ask Mapbox exactly how much we need to zoom to break this cluster
    let expansionZoom: number;
    const effectiveZoom = currentZoomRef.current > 1 ? currentZoomRef.current : 5;
    
    try {
      if (shapeSourceRef.current && clusterId !== undefined) {
        // Get the exact zoom level needed to expand this cluster
        // NOTE: rnmapbox expects the FEATURE object, not just the cluster_id
        expansionZoom = await shapeSourceRef.current.getClusterExpansionZoom(feature);
        console.log(`🎯 Mapbox expansion zoom: ${expansionZoom}`);
        
        // Add +0.5 to ensure the cluster actually breaks
        expansionZoom = Math.min(expansionZoom + 0.5, 18);
      } else {
        // Fallback if cluster_id not available
        expansionZoom = Math.min(effectiveZoom + 3, 18);
        console.log(`⚠️ No cluster_id, using fallback zoom: ${expansionZoom}`);
      }
    } catch (error) {
      console.log('⚠️ getClusterExpansionZoom failed, using fallback:', error);
      expansionZoom = Math.min(effectiveZoom + 3, 18);
    }
    
    console.log(`🎬 CINEMATIC DIVE: zooming to ${expansionZoom.toFixed(1)}`);
    
    // The "Cinematic Dive" - flyTo for curved game-like movement
    flyToCamera({
      center: coordinates,
      zoom: expansionZoom,
      pitch: 45, // Lean in like an RPG
      duration: 1200,
      mode: 'flyTo',
    });
    
    // Update zoom ref for future calculations
    currentZoomRef.current = expansionZoom;
    
    // Unlock after animation
    setTimeout(() => {
      isClusterAnimatingRef.current = false;
      console.log('🔓 Animation complete');
    }, 1300);
    
  }, [flyToCamera]);

  // handlePinPress is defined after handlePlaceSelect (see below)

  // Legacy bubble handlers REMOVED - now using cluster/pin tap handlers above

  // Ref to track if we're in fly-to animation (prevent scroll sync from interfering)
  const isAnimatingRef = useRef(false);
  
  // heroCoordinatesRef is used for orbit functionality (no visible beacon anymore)
  
  // State for selected place (full object for HUD display)
  const [selectedPlace, setSelectedPlace] = useState<SavedItem | null>(null);
  
  // Track current bearing for 360° orbit
  const currentBearingRef = useRef(0);
  const [isOrbiting, setIsOrbiting] = useState(false);
  const isOrbitingRef = useRef(false); // Ref to avoid stale closures
  const heroCoordinatesRef = useRef<[number, number] | null>(null);
  
  // Track if user has panned away from hero building (show re-center button)
  const [showRecenter, setShowRecenter] = useState(false);

  // 360° CINEMATIC ORBIT - "Inspect" the building like in games
  const triggerOrbit = useCallback(() => {
    const coords = heroCoordinatesRef.current;
    if (isOrbitingRef.current || !coords) {
      console.log('Orbit blocked:', { isOrbiting: isOrbitingRef.current, coords });
      return;
    }
    
    console.log('🌀 TRIGGERING 360° ORBIT at:', coords);
    isOrbitingRef.current = true;
    setIsOrbiting(true);
    
    // Heavy haptic for dramatic effect
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    const startBearing = currentBearingRef.current;
    const targetBearing = startBearing + 360;
    
    console.log('🎥 Camera orbit:', { startBearing, targetBearing, coords });
    
    // CONTROLLED CAMERA: 360° spin - Note: For orbit we still use ref because
    // we need linearTo animation mode which is better handled imperatively
    cameraRef.current?.setCamera({
      centerCoordinate: coords,
      zoomLevel: 17.5,
      pitch: 65,
      heading: targetBearing,
      animationDuration: 4000,
      animationMode: 'linearTo',
    });
    
    // Update bearing ref and reset orbiting state after animation
    setTimeout(() => {
      currentBearingRef.current = targetBearing % 360;
      isOrbitingRef.current = false;
      setIsOrbiting(false);
      // Light haptic to signal orbit complete
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      console.log('✅ Orbit complete');
    }, 4000);
  }, []);

  // Handle building tap on map - triggers orbit
  const handleBuildingTap = useCallback(() => {
    console.log('🏢 Building tapped! Triggering orbit...');
    triggerOrbit();
  }, [triggerOrbit]);

  // Open Google Maps for directions
  const openGoogleMaps = useCallback((place: SavedItem) => {
    console.log('🧭 GO BUTTON PRESSED! Opening Google Maps for:', place.name);
    if (!place.location_lat || !place.location_lng) {
      console.log('❌ No coordinates for place');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const url = Platform.select({
      ios: `maps://app?daddr=${place.location_lat},${place.location_lng}`,
      android: `google.navigation:q=${place.location_lat},${place.location_lng}`,
    });
    
    // Fallback to Google Maps web
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.location_lat},${place.location_lng}`;
    
    Linking.canOpenURL(url || '').then((supported) => {
      if (supported) {
        Linking.openURL(url || webUrl);
      } else {
        Linking.openURL(webUrl);
      }
    });
  }, []);

  // Mark place as visited (check-in)
  const handleCheckIn = useCallback(async (place: SavedItem) => {
    console.log('✅ CHECK-IN! Marking as visited:', place.name);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // TODO: API call to update place status
    // For now just show feedback
    // await api.patch(`/api/saved-items/${place.id}`, { status: 'visited' });
    
    // Close the bottom sheet after check-in
    setBottomSheetVisible(false);
    setSelectedPlace(null);
    setSelectedPlaceId(undefined);
  }, []);

  // Calculate best viewing angle based on place position relative to map center
  const calculateBestBearing = useCallback((lng: number, lat: number): number => {
    // Calculate bearing that frames the building nicely
    // Rotate slightly based on longitude to add variety
    const baseBearing = ((lng * 10) % 60) - 30; // Range: -30 to 30
    return baseBearing;
  }, []);

  // Handle map tap - Google Maps style: minimize drawer or trigger orbit
  const handleMapPress = useCallback((event: any) => {
    const tapCoords = event.geometry?.coordinates as [number, number];
    if (!tapCoords) return;
    
    // If PlaceDetailSheet is open (single place selected)
    if (bottomSheetVisible && bottomSheetItems.length === 1) {
      // Check if tapped near the selected place (for orbit)
      if (heroCoordinatesRef.current && !isOrbitingRef.current) {
        const distance = getDistanceMeters(tapCoords, heroCoordinatesRef.current);
        console.log('🗺️ Map tapped at:', tapCoords, 'Distance to selected:', distance.toFixed(0) + 'm');
        
        // If tapped within 150m of selected place, trigger orbit
        if (distance < 150) {
          console.log('🏢 BUILDING AREA TAPPED! Triggering 360° orbit...');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          triggerOrbit();
          return;
        }
      }
      
      // Tapped elsewhere on map - minimize drawer to peek (Google Maps behavior)
      console.log('🗺️ Map tapped - minimizing drawer to peek');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      placeDetailSheetRef.current?.peek();
      return;
    }
    
    // No drawer open - normal behavior (could add other interactions here)
  }, [getDistanceMeters, triggerOrbit, bottomSheetVisible, bottomSheetItems.length]);

  // Re-center camera on hero building
  const handleRecenter = useCallback(() => {
    if (!heroCoordinatesRef.current) return;
    
    console.log('🎯 RE-CENTERING on hero building');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const coords = heroCoordinatesRef.current;
    const bearing = currentBearingRef.current;
    
    // RPG: Fly back to the building with cinematic movement
    flyToCamera({
      center: coords,
      zoom: 16.5,
      pitch: 70,
      heading: bearing,
      duration: 800,
      mode: 'flyTo',
    });
    
    setShowRecenter(false);
  }, [flyToCamera]);

  // Handle place selection - CINEMATIC "LOCK-ON" fly-to + show PlaceDetailSheet
  const handlePlaceSelect = useCallback((place: SavedItem) => {
    // 1. HAPTIC FEEDBACK - Physical "lock-on" feel
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setSelectedPlaceId(place.id);
    selectedPlaceIdRef.current = place.id;
    setSelectedPlace(place); // Store full place for HUD
    
    // 2. SET UP BOTTOM SHEET for single place view (PlaceDetailSheet)
    setBottomSheetItems([place]);
    setBottomSheetLabel(place.name || 'Place');
    setBottomSheetEmoji(CATEGORY_ICONS[place.category || 'place'] || '📍');
    setBottomSheetVisible(true);
    
    // Mark as animating
    isAnimatingRef.current = true;
    
    if (place.location_lat && place.location_lng) {
      const lng = place.location_lng;
      const lat = place.location_lat;
      
      // Store coords for orbit (no glowing beacon - icons are enough!)
      const coords: [number, number] = [lng, lat];
      heroCoordinatesRef.current = coords; // Keep ref for orbit functionality
      
      // 3. Calculate best viewing angle
      const bestBearing = calculateBestBearing(lng, lat);
      
      // RPG CAMERA: Cinematic lock-on with flyTo
      // Phase 1: Quick zoom out + center
      flyToCamera({
        center: coords,
        zoom: 14,
        pitch: 30,
        heading: 0,
        duration: 300,
        mode: 'easeTo',
      });
      
      // Phase 2: Zoom in with tilt ("Hero Reveal")
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        flyToCamera({
          center: coords,
          zoom: 16.5,
          pitch: 65,
          heading: bestBearing,
          duration: 800,
          mode: 'flyTo',
        });
        currentBearingRef.current = bestBearing;
        currentZoomRef.current = 16.5;
      }, 350);
      
      // Clear animation flag after full animation
      setTimeout(() => {
        isAnimatingRef.current = false;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 1200);
    }
  }, [calculateBestBearing, flyToCamera, CATEGORY_ICONS]);

  // Handle individual pin tap - find place and call handlePlaceSelect
  const handlePinPress = useCallback((feature: any) => {
    const placeId = feature.properties?.id;
    if (!placeId) return;
    
    // Find the place in our items and select it
    const place = items.find(item => item.id === placeId);
    if (place) {
      handlePlaceSelect(place);
    }
  }, [items, handlePlaceSelect]);

  // Handle scroll sync - pan camera to visible place (disabled during fly-to animation)
  const handlePlaceScroll = useCallback((place: SavedItem) => {
    // Don't interfere with fly-to animation or if a place is already selected
    // Using refs to avoid stale closure
    if (isAnimatingRef.current || selectedPlaceIdRef.current) {
      return;
    }
    
    if (place.location_lat && place.location_lng) {
      // RPG: Smooth pan to place
      flyToCamera({
        center: [place.location_lng!, place.location_lat!],
        zoom: 14,
        pitch: 45,
        duration: 500,
        mode: 'easeTo',
      });
    }
  }, [flyToCamera]);

  // Close bottom sheet - return to map view
  const handleBottomSheetClose = useCallback(() => {
    // Haptic feedback on close
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setBottomSheetVisible(false);
    setSelectedPlaceId(undefined);
    selectedPlaceIdRef.current = undefined;
    setSelectedPlace(null);
    setShowRecenter(false);
    
    // Clear hero coordinates ref (used for orbit)
    heroCoordinatesRef.current = null;
    
    // Exit RPG flow IMMEDIATELY
    isInRPGFlowRef.current = false;
    
    // Reset cluster animation lock
    isClusterAnimatingRef.current = false;
    
    // RPG: Zoom out with flyTo (keeps the current center)
    cameraRef.current?.setCamera({
      zoomLevel: 10,
      pitch: 0,
      animationDuration: 400,
      animationMode: 'easeTo',
    });
    currentZoomRef.current = 10;
    
    console.log('🔙 Bottom sheet closed, camera reset');
  }, []);

  // Legacy handleMicroBubblePress REMOVED - no longer using bubbles

  // Handle native back gesture/button - ensures drawer closes before screen exits
  useEffect(() => {
    // 1. DYNAMIC GESTURE CONTROL (iOS/Android Gestures)
    // Disable native swipe-back while drawer is open so user doesn't accidentally exit
    navigation.setOptions({
      gestureEnabled: !bottomSheetVisible,
    });

    // 2. HARDWARE BACK BUTTON (Android)
    const onBackPress = () => {
      if (bottomSheetVisible) {
        handleBottomSheetClose();
        return true; // Stop propagation (don't exit screen)
      }
      return false; // Exit screen normally
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => {
      backHandler.remove();
      // Ensure gesture is re-enabled on unmount
      navigation.setOptions({ gestureEnabled: true });
    };
  }, [bottomSheetVisible, handleBottomSheetClose, navigation]);

  const handleBack = () => {
    // Close any open UI elements first
    if (bottomSheetVisible) {
      handleBottomSheetClose();
      return;
    }
    navigation.goBack();
  };

  // Chat handlers
  const handleOrbPress = () => setIsCompactChatOpen(true);
  const handleCloseCompactChat = () => { setIsCompactChatOpen(false); Keyboard.dismiss(); };
  const handleOpenFullChat = () => { setIsCompactChatOpen(false); navigation.navigate('AgentChat', { tripId, countryName }); };

  const handleSendMessage = async (message: string) => {
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, type: 'user', content: message, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);

    const { isLocationQuery, location: detectedLocation, coords, radiusKm } = detectLocationQuery(message, countryName);

    if (isLocationQuery) {
      // Handle "near me" - check if user is in country first
      if (detectedLocation === 'nearMe') {
        if (!location) {
          setChatMessages(prev => [...prev, {
            id: `ai-${Date.now()}`, type: 'ai',
            content: "📍 Can't get your location. Please enable GPS and try again.",
            timestamp: new Date(),
          }]);
          return;
        }
        
        const inCountry = isInCountry(location.coords.latitude, location.coords.longitude, countryName);
        if (!inCountry) {
          setChatMessages(prev => [...prev, {
            id: `ai-${Date.now()}`, type: 'ai',
            content: `✈️ You're not in ${countryName} yet!\n\nThis feature works when you're traveling there. Try "Take me to ${countryName === 'Japan' ? 'Shibuya' : countryName === 'Thailand' ? 'Bangkok' : 'the city'}" to explore specific areas.`,
            timestamp: new Date(),
          }]);
          return;
        }
        
        handleNearMePress();
        setChatMessages(prev => [...prev, {
          id: `ai-${Date.now()}`, type: 'ai',
          content: `📍 Showing places near you (${currentRadiusKm}km radius)`,
          timestamp: new Date(),
        }]);
        return;
      }
      
      // Handle radius command - check if user is in country first
      if (radiusKm && location) {
        const inCountry = isInCountry(location.coords.latitude, location.coords.longitude, countryName);
        if (!inCountry) {
          setChatMessages(prev => [...prev, {
            id: `ai-${Date.now()}`, type: 'ai',
            content: `✈️ You're not in ${countryName} yet!\n\nRadius filtering works when you're traveling there. For now, try "Take me to ${countryName === 'Japan' ? 'Tokyo' : countryName === 'Thailand' ? 'Bangkok' : 'the city'}" to explore specific areas.`,
            timestamp: new Date(),
          }]);
          return;
        }
        
        applyNearMeFilter(location.coords.latitude, location.coords.longitude, radiusKm);
        const nearbyItems = filterItemsByRadius(allItems, location.coords.latitude, location.coords.longitude, radiusKm);
        setChatMessages(prev => [...prev, {
          id: `ai-${Date.now()}`, type: 'ai',
          content: `📍 Showing ${nearbyItems.length} places within ${radiusKm}km`,
          timestamp: new Date(),
        }]);
        return;
      }
      
      // Handle specific area
      if (detectedLocation && coords) {
        applyAreaFilter(detectedLocation, coords);
        const areaItems = filterItemsByLocation(allItems, detectedLocation, coords);
        setChatMessages(prev => [...prev, {
          id: `ai-${Date.now()}`, type: 'ai',
          content: `📍 Moving to ${detectedLocation}!\n\nFound ${areaItems.length} places here.`,
          timestamp: new Date(),
        }]);
        return;
      }
      
      // Handle reset
      if (detectedLocation === null && coords === null) {
        resetToCountryView();
        setChatMessages(prev => [...prev, {
          id: `ai-${Date.now()}`, type: 'ai',
          content: `🗺️ Showing all ${allItems.length} places in ${countryName}!`,
          timestamp: new Date(),
        }]);
        return;
      }
    }

    // Send to AI backend
    setIsAITyping(true);
    try {
      const locationData = location ? { lat: location.coords.latitude, lng: location.coords.longitude } : undefined;
      await sendQuery(tripId, message, locationData);
      const storeMessages = getMessages(tripId);
      const latestAIMessage = storeMessages.filter(m => m.type === 'companion').pop();
      setChatMessages(prev => [...prev, {
        id: `ai-${Date.now()}`, type: 'ai',
        content: latestAIMessage?.content || "I found some great places! Tap expand to see details 🗺️",
        timestamp: new Date(),
      }]);
    } catch (error) {
      setChatMessages(prev => [...prev, {
        id: `ai-${Date.now()}`, type: 'ai', content: "Oops! Something went wrong. Try again? 😅", timestamp: new Date(),
      }]);
    } finally {
      setIsAITyping(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  // Dynamic suggestions based on map context
  const dynamicSuggestions = useMemo(() => {
    const suggestions = [];
    
    // 1. If we have active area filter (e.g. "Shibuya")
    if (activeAreaFilter && activeAreaFilter !== 'Near You' && activeAreaFilter !== '0 in view') {
      suggestions.push(`☕ Hidden cafes in ${activeAreaFilter}`);
      suggestions.push(`🍔 Best food in ${activeAreaFilter}`);
    } else if (drawerItems.length > 0) {
      // 2. If we have items in view
      suggestions.push(`🎯 What's nearby?`);
      suggestions.push(`🍹 Nightlife around here`);
    } else {
      // 3. Default suggestions for the country
      suggestions.push(`🏞️ Top things to do in ${countryName}`);
      suggestions.push(`🏨 Best places to stay`);
    }
    
    return suggestions;
  }, [activeAreaFilter, drawerItems.length, countryName]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Map Background - Mapbox */}
      <MapView
        ref={mapViewRef}
        style={styles.map}
        styleURL={MAPBOX_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        onMapIdle={handleMapIdle}
        onPress={handleMapPress}
      >
        {/* Load category icons from CDN */}
        <Images images={PIN_ICONS} />

        {/* RPG CAMERA - Uses ref-only approach to avoid state fighting
            defaultSettings is ONLY used for initial position, then camera is free-roaming
            All animations go through cameraRef.setCamera() */}
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: initialCameraConfig.centerCoordinate,
            zoomLevel: initialCameraConfig.zoomLevel,
          }}
          followUserLocation={false}
          minZoomLevel={1}
          maxZoomLevel={20}
          maxBounds={countryBounds ? {
            ne: [countryBounds.maxLng + 2, countryBounds.maxLat + 2],
            sw: [countryBounds.minLng - 2, countryBounds.minLat - 2],
          } : undefined}
        />

        {/* PLACES HOTSPOTS (CLUSTERS) - Purple density glow */}
        {placesGeoJSON.features.length > 0 && (
          <ShapeSource
            id="places-hotspots-source"
            shape={placesGeoJSON}
            cluster={true}
            clusterRadius={60}
            clusterMaxZoomLevel={14}
            onPress={(e) => {
              const feature = e.features?.[0];
              if (feature?.properties?.cluster) {
                handleClusterPress(feature);
              }
            }}
          >
            {/* DENSITY GLOW - Hotspots at low zoom levels (Digital "Radar" Hotspots) */}
            <CircleLayer
              id="density-glow"
              filter={['has', 'point_count']}
              style={{
                circleRadius: [
                  'interpolate',
                  ['linear'],
                  ['get', 'point_count'],
                  2, 30,
                  10, 55,
                  50, 85
                ],
                circleColor: '#06B6D4', // Electric Cyan
                circleBlur: 0.8,
                circleOpacity: [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 0.6,
                  13, 0.3,
                  15, 0 // Fade out as we zoom in
                ],
              }}
            />
          </ShapeSource>
        )}

        {/* INDIVIDUAL PINS - Always visible, Google Maps / Airbnb style */}
        {placesGeoJSON.features.length > 0 && (
          <ShapeSource
            ref={shapeSourceRef}
            id="places-pins-source"
            shape={placesGeoJSON}
            cluster={false}
            onPress={(e) => {
              const feature = e.features?.[0];
              if (feature?.properties?.id) {
                handlePinPress(feature);
              }
            }}
          >
            {/* PIN SHADOW - For "Premium" feel */}
            <CircleLayer
              id="pin-shadow"
              style={{
                circleRadius: [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 8,
                  12, 12,
                  16, 16
                ],
                circleColor: '#000000',
                circleOpacity: 0.4,
                circleBlur: 0.5,
                circleTranslate: [0, 2],
                circleSortKey: ['get', 'rank'],
              }}
            />

            {/* SELECTED PIN HIGHLIGHT - Glow ring behind selected pin */}
            <CircleLayer
              id="selected-pin-glow"
              filter={['==', ['get', 'id'], selectedPlaceId || '__none__']}
              style={{
                circleRadius: 32,
                circleColor: '#06B6D4',
                circleOpacity: 0.5,
                circleBlur: 0.8,
                circleSortKey: ['+', ['get', 'rank'], 100], // Always on top of other pins
              }}
            />

            {/* INTELLIGENT PINS - Solid circles with colored stroke */}
            <CircleLayer
              id="unclustered-pins"
              style={{
                circleRadius: [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 8,
                  12, 12,
                  16, 16
                ],
                circleColor: ['get', 'color'],
                circleOpacity: 1.0,
                circleStrokeWidth: [
                  'case',
                  ['==', ['get', 'id'], selectedPlaceId || '__none__'],
                  4,
                  2
                ],
                circleStrokeColor: [
                  'case',
                  ['==', ['get', 'id'], selectedPlaceId || '__none__'],
                  '#06B6D4',
                  '#FFFFFF'
                ],
                circleSortKey: ['get', 'rank'], // Higher rank = on top
              }}
            />

            {/* PIN ICONS - Category icons on top of circles */}
            <SymbolLayer
              id="pin-icons"
              style={{
                iconImage: ['get', 'iconName'],
                iconSize: [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 0.25,
                  12, 0.35,
                  16, 0.45
                ],
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
                iconAnchor: 'center',
                symbolSortKey: ['get', 'rank'],
              }}
            />

            {/* PIN LABELS - Names only at high zoom (zoom 15+) */}
            <SymbolLayer
              id="pin-labels"
              style={{
                textField: [
                  'step',
                  ['zoom'],
                  '',
                  15, ['get', 'name']
                ],
                textSize: 12,
                textColor: '#FFFFFF',
                textHaloColor: 'rgba(10, 10, 26, 0.95)',
                textHaloWidth: 2,
                textOffset: [0, 2.4],
                textAnchor: 'top',
                textAllowOverlap: false,
                textIgnorePlacement: false,
                symbolSortKey: ['get', 'rank'],
              }}
            />

            {/* RATING BADGE - Small badge for quality places (zoom 13+) */}
            <CircleLayer
              id="rating-badge-bg"
              filter={['>', ['get', 'rating'], 0]}
              style={{
                circleRadius: [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12, 0,
                  13, 8,
                  16, 10
                ],
                circleColor: '#FFFFFF',
                circleStrokeWidth: 1.5,
                circleStrokeColor: '#FFD700',
                circleTranslate: [10, 10],
                circleSortKey: ['+', ['get', 'rank'], 1], // On top of the pin it belongs to
              }}
            />

            <SymbolLayer
              id="rating-badge-text"
              filter={['>', ['get', 'rating'], 0]}
              style={{
                textField: [
                  'step',
                  ['zoom'],
                  '',
                  13, ['number-format', ['get', 'rating'], { 'max-fraction-digits': 1 }]
                ],
                textSize: 9,
                textFont: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                textColor: '#1a1a1a',
                textAllowOverlap: true,
                textOffset: [1.1, 1.1],
                symbolSortKey: ['+', ['get', 'rank'], 2],
              }}
            />
          </ShapeSource>
        )}

        {/* GHOST PIN (Discovery Intent) - AI SONAR RADAR */}
        {discoveryGeoJSON && (
          <ShapeSource
            id="discovery-intent-source"
            shape={discoveryGeoJSON}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setIsScoutCarouselVisible(true);
            }}
          >
            {/* Outer Sonar Ripple 1 */}
            <CircleLayer
              id="ghost-pin-ripple-1"
              style={{
                circleRadius: [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 50,
                  12, 80,
                  16, 120
                ],
                circleColor: '#06B6D4',
                circleOpacity: 0.15,
                circleBlur: 0.5,
              }}
            />
            {/* Inner Sonar Ripple 2 */}
            <CircleLayer
              id="ghost-pin-ripple-2"
              style={{
                circleRadius: [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 25,
                  12, 40,
                  16, 60
                ],
                circleColor: '#22D3EE',
                circleOpacity: 0.2,
              }}
            />
            {/* Core Scanner Ring */}
            <CircleLayer
              id="ghost-pin-core"
              style={{
                circleRadius: [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 12,
                  12, 16,
                  16, 20
                ],
                circleColor: '#06B6D4',
                circleStrokeWidth: 3,
                circleStrokeColor: '#FFFFFF',
                circlePitchAlignment: 'map',
              }}
            />
            {/* AI Search Icon */}
            <SymbolLayer
              id="ghost-pin-icon"
              style={{
                textField: '✨',
                textSize: [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 14,
                  12, 18,
                  16, 22
                ],
                textColor: '#FFFFFF',
                textHaloColor: 'rgba(6, 182, 212, 0.8)',
                textHaloWidth: 2,
              }}
            />
            <SymbolLayer
              id="ghost-pin-label"
              style={{
                textField: ['get', 'name'],
                textSize: 13,
                textColor: '#06B6D4',
                textHaloColor: 'rgba(10, 10, 26, 0.9)',
                textHaloWidth: 2,
                textOffset: [0, 2.5],
                textAnchor: 'top',
                textTransform: 'uppercase',
                textLetterSpacing: 1,
                fontWeight: '800',
              }}
            />
          </ShapeSource>
        )}
        
        {/* HERO BEACON REMOVED - Category icons on pins are enough visual feedback */}
        
        {/* GO and ORBIT buttons are in the HUD (GameBottomSheet) - more reliable than MarkerView */}
      </MapView>

      {/* Gradient Overlay - Dark theme */}
      <LinearGradient
        colors={['rgba(10, 10, 26, 0.6)', 'rgba(10, 10, 26, 0.2)', 'rgba(10, 10, 26, 0.5)']}
        locations={[0, 0.5, 1]}
        style={styles.gradientOverlay}
        pointerEvents="none"
      />

      {/* Floating Clouds - REMOVED (was part of bubble UI) */}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <MotiView from={{ opacity: 0, translateY: -10 }} animate={{ opacity: 1, translateY: 0 }}>
            <TouchableOpacity style={styles.countryHeader} onPress={handleBack}>
              <View style={styles.backButtonInner}>
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.countryInfo}>
                <Text style={styles.countryTitle}>{countryFlag} {countryName}</Text>
                <Text style={styles.placeCount}>
                  {discoveryIntent ? `🔍 Scouting ${discoveryIntent.item}...` : 
                   filterMode !== 'all' ? `${items.length} spots nearby` : `${items.length} saved`}
                </Text>
              </View>
            </TouchableOpacity>
          </MotiView>

          {/* Near Me Button - Top Right */}
          <MotiView from={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
            <TouchableOpacity
              style={[styles.headerActionButton, filterMode === 'nearMe' && styles.headerActionButtonActive]}
              onPress={handleNearMePress}
              activeOpacity={0.8}
            >
              <Ionicons 
                name="locate" 
                size={22} 
                color={filterMode === 'nearMe' ? '#FFFFFF' : '#06B6D4'} 
              />
            </TouchableOpacity>
          </MotiView>
        </View>

        {/* Filter Chip - shows for explicit filters */}
        {filterMode !== 'all' && (
          <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.filterChipContainer}>
            <TouchableOpacity style={styles.filterChip} onPress={resetToCountryView} activeOpacity={0.8}>
              <Ionicons 
                name="location" 
                size={14} 
                color="#06B6D4" 
              />
              <Text style={styles.filterChipText}>
                {activeAreaFilter || `${currentRadiusKm}km`}
              </Text>
              <Ionicons name="close-circle" size={16} color="#06B6D4" />
            </TouchableOpacity>
          </MotiView>
        )}
      </View>

      {/* Category Filter Chips - Horizontal Scrollable */}
      <View style={styles.categoryChipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsScroll}
        >
          {CATEGORY_FILTERS.map((category) => {
            const count = categoryCounts[category.key];
            const isSelected = selectedCategory === category.key;
            // Don't show chips with 0 items (except "All")
            if (count === 0 && category.key !== 'all') return null;
            
            return (
              <TouchableOpacity
                key={category.key}
                style={[
                  styles.categoryChip,
                  isSelected && { backgroundColor: category.color, borderColor: category.color },
                ]}
                onPress={() => handleCategorySelect(category.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryChipIcon}>{category.icon}</Text>
                <Text style={[
                  styles.categoryChipLabel,
                  isSelected && styles.categoryChipLabelActive,
                ]}>
                  {category.label}
                </Text>
                <View style={[
                  styles.categoryChipCount,
                  isSelected && styles.categoryChipCountActive,
                ]}>
                  <Text style={[
                    styles.categoryChipCountText,
                    isSelected && styles.categoryChipCountTextActive,
                  ]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* CLUSTERS AND PINS are now rendered inside MapView - see ShapeSource "places-source" */}

      {/* Persistent Places Drawer - Shows places visible in current map view */}
      {/* Hide when single place detail sheet is open to avoid overlap */}
      {!isSinglePlaceDetailOpen && (
        <PersistentPlacesDrawer
          ref={placesDrawerRef}
          items={drawerItems}
          selectedCategory={selectedCategory}
          categoryLabel={currentCategoryConfig.label}
          categoryEmoji={currentCategoryConfig.icon}
          categoryColor={currentCategoryConfig.color}
          onPlaceSelect={handlePlaceSelect}
          selectedPlaceId={selectedPlaceId}
        />
      )}

      {/* Game Bottom Sheet - For MULTIPLE places (clusters) */}
      {bottomSheetItems.length > 1 && (
        <GameBottomSheet
          ref={bottomSheetRef}
          items={bottomSheetItems}
          categoryLabel={bottomSheetLabel}
          categoryEmoji={bottomSheetEmoji}
          isVisible={bottomSheetVisible}
          onClose={handleBottomSheetClose}
          onPlaceSelect={handlePlaceSelect}
          onPlaceScroll={handlePlaceScroll}
          selectedPlaceId={selectedPlaceId}
          selectedPlace={selectedPlace}
          onDirections={openGoogleMaps}
          onCheckIn={handleCheckIn}
          onOrbit={triggerOrbit}
          isOrbiting={isOrbiting}
        />
      )}

      {/* Place Detail Sheet - For SINGLE place (Google Maps style with fixed footer) */}
      <PlaceDetailSheet
        ref={placeDetailSheetRef}
        place={bottomSheetItems.length === 1 ? bottomSheetItems[0] : null}
        isVisible={bottomSheetVisible && bottomSheetItems.length === 1}
        onClose={handleBottomSheetClose}
        onDirections={openGoogleMaps}
        onCheckIn={handleCheckIn}
      />

      {/* RE-CENTER BUTTON - Shows when user pans away from hero building */}
      {showRecenter && bottomSheetVisible && (
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', damping: 15 }}
          style={styles.recenterContainer}
        >
          <TouchableOpacity
            style={styles.recenterButton}
            onPress={handleRecenter}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#8B5CF6', '#6366F1']}
              style={styles.recenterGradient}
            >
              <Ionicons name="locate" size={20} color="white" />
              <Text style={styles.recenterText}>Re-center</Text>
            </LinearGradient>
          </TouchableOpacity>
        </MotiView>
      )}

      {/* Empty State - Only show when NO places saved at all */}
      {!isLoading && allItems.length === 0 && (
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.emptyState}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🗺️</Text>
            <Text style={styles.emptyTitle}>No places yet</Text>
            <Text style={styles.emptySubtitle}>
              {`Share videos about ${countryName} to add places`}
            </Text>
          </View>
        </MotiView>
      )}

      {/* Floating AI Orb */}
      <FloatingAIOrb onPress={handleOrbPress} visible={!isCompactChatOpen} />

      {/* Compact AI Chat */}
      <CompactAIChat
        isOpen={isCompactChatOpen}
        onClose={handleCloseCompactChat}
        onOpenFullChat={handleOpenFullChat}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isTyping={isAITyping || companionLoading}
        suggestions={dynamicSuggestions}
      />

      {/* Scout Carousel Overlay */}
      {isScoutCarouselVisible && scoutResults.length > 0 && (
        <View style={styles.scoutOverlay}>
          <TouchableOpacity 
            style={styles.scoutOverlayBackdrop} 
            activeOpacity={1} 
            onPress={() => setIsScoutCarouselVisible(false)} 
          />
          <View style={styles.scoutOverlayContent}>
            <ScoutCarousel
              scouts={scoutResults}
              intentItem={discoveryIntent?.item}
              intentCity={discoveryIntent?.city}
              onSelect={handleScoutSelect}
              onClose={() => setIsScoutCarouselVisible(false)}
            />
          </View>
        </View>
      )}

      {/* Skeleton Loading State */}
      {isLoading && (
        <View style={styles.skeletonOverlay}>
          {/* Header Skeleton */}
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <SkeletonLoader width={180} height={48} borderRadius={24} />
              <SkeletonLoader width={44} height={44} borderRadius={22} />
            </View>
          </View>

          {/* Chips Skeleton */}
          <View style={[styles.categoryChipsContainer, { marginTop: 10 }]}>
            <View style={styles.categoryChipsScroll}>
              {[1, 2, 3, 4].map((i) => (
                <SkeletonLoader key={i} width={80} height={36} borderRadius={18} style={{ marginRight: 8 }} />
              ))}
            </View>
          </View>

          {/* Bottom Drawer Skeleton */}
          <View style={styles.drawerSkeleton}>
            <View style={styles.drawerSkeletonHeader}>
              <SkeletonLoader width={120} height={20} borderRadius={10} />
              <SkeletonLoader width={40} height={24} borderRadius={12} />
            </View>
            <View style={styles.drawerSkeletonContent}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.drawerSkeletonCard}>
                  <SkeletonLoader width={110} height={80} borderRadius={14} />
                  <SkeletonLoader width={80} height={12} borderRadius={6} style={{ marginTop: 8 }} />
                  <SkeletonLoader width={40} height={10} borderRadius={5} style={{ marginTop: 4 }} />
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  map: { ...StyleSheet.absoluteFillObject },
  gradientOverlay: { ...StyleSheet.absoluteFillObject },
  
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 17, 21, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  headerActionButtonActive: {
    backgroundColor: '#06B6D4',
    borderColor: '#22D3EE',
  },
  countryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 17, 21, 0.85)',
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  backButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  countryInfo: {
    justifyContent: 'center',
  },
  countryTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  placeCount: { fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', marginTop: 1 },
  
  filterChipContainer: { marginTop: 10, marginLeft: 10 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20,
    alignSelf: 'flex-start', gap: 8,
    borderWidth: 1, borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  filterChipText: { fontSize: 14, fontWeight: '600', color: '#06B6D4' },
  
  viewModeLabel: {
    marginTop: 12, backgroundColor: 'rgba(6, 182, 212, 0.1)',
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, alignSelf: 'flex-start',
  },
  viewModeLabelText: { fontSize: 12, fontWeight: '600', color: '#06B6D4' },
  
  // Category Filter Chips
  categoryChipsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 135 : 120,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  categoryChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 17, 21, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.1)',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4,
    elevation: 4,
  },
  categoryChipIcon: {
    fontSize: 14,
  },
  categoryChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  categoryChipLabelActive: {
    color: '#FFFFFF',
  },
  categoryChipCount: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: 'center',
  },
  categoryChipCountActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  categoryChipCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  categoryChipCountTextActive: {
    color: '#FFFFFF',
  },
  
  emptyState: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', padding: 40, zIndex: 10,
  },
  emptyCard: {
    backgroundColor: 'rgba(15, 17, 21, 0.95)',
    borderRadius: 24, padding: 32, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
    borderWidth: 1, borderColor: 'rgba(6, 182, 212, 0.1)',
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' },
  resetButton: {
    marginTop: 16, backgroundColor: '#06B6D4',
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12,
  },
  resetButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 17, 21, 0.95)',
    justifyContent: 'center', alignItems: 'center', zIndex: 50,
  },
  skeletonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F1115',
    zIndex: 100,
  },
  drawerSkeleton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.22,
    backgroundColor: '#17191F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  drawerSkeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  drawerSkeletonContent: {
    flexDirection: 'row',
    gap: 12,
  },
  drawerSkeletonCard: {
    width: 110,
  },
  loadingCard: {
    backgroundColor: 'rgba(15, 17, 21, 0.95)', borderRadius: 20, padding: 32, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
    borderWidth: 1, borderColor: 'rgba(6, 182, 212, 0.1)',
  },
  
  // Re-center button (appears when user pans away)
  recenterContainer: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    zIndex: 100,
  },
  recenterButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  recenterGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  recenterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  
  // Floating GO button (Quest Marker)
  floatingGoButton: {
    shadowColor: '#FF6600',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  floatingGoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  floatingGoText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  
  // Building tap area for 360° orbit
  buildingTapArea: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbitHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.5)',
  },
  orbitHintActive: {
    backgroundColor: 'rgba(255, 153, 0, 0.8)',
  },
  orbitHintText: {
    color: '#FFCC00',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  
  // Orbiting indicator
  orbitingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFCC00',
  },
  orbitingText: {
    color: '#FFCC00',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
    letterSpacing: 1,
  },
  
  loadingText: { fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', marginTop: 16 },

  // Scout Overlay Styles
  scoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none', // Ensure map stays interactive while carousel is open
  },
  scoutOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 26, 0.7)',
  },
  scoutOverlayContent: {
    backgroundColor: '#17191F',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
});
