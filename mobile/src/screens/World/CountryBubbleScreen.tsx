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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import Mapbox, { MapView, Camera, ShapeSource, CircleLayer, MarkerView } from '@rnmapbox/maps';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import api from '../../config/api';

// Initialize Mapbox
const MAPBOX_TOKEN = Constants.expoConfig?.extra?.mapboxAccessToken || 
                     process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
Mapbox.setAccessToken(MAPBOX_TOKEN);
import { SavedItem, ItemCategory, SubClusters } from '../../types';
import { FloatingCloud, GlowingBubble } from '../../components/bubbles';
import { FloatingAIOrb } from '../../components/FloatingAIOrb';
import { CompactAIChat } from '../../components/CompactAIChat';
import { GameBottomSheet, GameBottomSheetRef } from '../../components/GameBottomSheet';
import { OrbitalBubbles } from '../../components/OrbitalBubbles';
import { useCompanionStore } from '../../stores/companionStore';
import { useLocationStore } from '../../stores/locationStore';

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

const CATEGORY_COLORS: Record<string, 'green' | 'blue' | 'yellow' | 'purple' | 'pink' | 'orange'> = {
  food: 'green', activity: 'blue', shopping: 'yellow',
  accommodation: 'purple', place: 'blue', tip: 'pink',
};

const SUBCATEGORY_COLORS: ('green' | 'blue' | 'yellow' | 'purple' | 'pink' | 'orange')[] = [
  'green', 'blue', 'pink', 'orange', 'purple', 'yellow'
];

// Mapbox style - navigation night for dark Zenly aesthetic
const MAPBOX_STYLE = 'mapbox://styles/mapbox/navigation-night-v1';

type ViewMode = 'macro' | 'micro';
type FilterMode = 'all' | 'nearMe' | 'area';

interface RouteParams {
  tripId: string;
  countryName: string;
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
 * Check if GPS coordinates are within a country's bounds
 */
function isInCountry(lat: number, lng: number, countryName: string): boolean {
  const bounds = COUNTRY_BOUNDS[countryName.toLowerCase()];
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
 * Filter items within visible map bounds
 * Mapbox bounds format: [[neLng, neLat], [swLng, swLat]]
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
  const lowerCountry = countryName.toLowerCase();
  
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
  const countryCities = CITY_COORDS[lowerCountry] || {};
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
  
  const params = route.params || {};
  const tripId = params.tripId || '';
  const countryName = params.countryName || 'Unknown';

  // Data state
  const [isLoading, setIsLoading] = useState(true);
  const [allItems, setAllItems] = useState<SavedItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<SavedItem[]>([]);
  const [subClusters, setSubClusters] = useState<SubClusters | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('macro');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Filter state
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [activeAreaFilter, setActiveAreaFilter] = useState<string | null>(null);
  const [activeAreaCoords, setActiveAreaCoords] = useState<CityCoords | null>(null);
  const [currentRadiusKm, setCurrentRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [userInCountry, setUserInCountry] = useState<boolean>(false);
  const [hasAutoFocused, setHasAutoFocused] = useState<boolean>(false);
  
  // Map bounds filtering state
  const [currentZoom, setCurrentZoom] = useState<number>(0);
  const [isMapFilterActive, setIsMapFilterActive] = useState<boolean>(false);
  const mapFilterTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Compact Chat state
  const [isCompactChatOpen, setIsCompactChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAITyping, setIsAITyping] = useState(false);

  // RPG UI State - Orbital Bubbles & Bottom Sheet
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedCategoryPosition, setExpandedCategoryPosition] = useState<{x: number; y: number}>({ x: 50, y: 50 });
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [bottomSheetItems, setBottomSheetItems] = useState<SavedItem[]>([]);
  const [bottomSheetLabel, setBottomSheetLabel] = useState('');
  const [bottomSheetEmoji, setBottomSheetEmoji] = useState('📍');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>(undefined);
  const bottomSheetRef = useRef<GameBottomSheetRef>(null);
  
  // Refs for checking state in callbacks (avoids stale closure issue)
  // These are updated IMMEDIATELY in handlers, not via useEffect (which is async)
  const isInRPGFlowRef = useRef<boolean>(false);
  const selectedPlaceIdRef = useRef<string | undefined>(undefined);

  // Stores
  const { sendQuery, isLoading: companionLoading, getMessages } = useCompanionStore();
  const { location, startTracking } = useLocationStore();

  const countryCoords = COUNTRY_COORDS[countryName.toLowerCase()] || COUNTRY_COORDS.default;
  const countryFlag = COUNTRY_FLAGS[countryName.toLowerCase()] || '🌍';
  const countryBounds = COUNTRY_BOUNDS[countryName.toLowerCase()];
  const items = filteredItems;

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

  const fetchItems = async () => {
    if (!tripId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const itemsResponse = await api.get(`/trips/${tripId}/items`);
      const fetchedItems: SavedItem[] = itemsResponse.data.data || itemsResponse.data || [];
      setAllItems(fetchedItems);
      setFilteredItems(fetchedItems);

      try {
        const clustersResponse = await api.get(`/trips/${tripId}/items/sub-clusters`);
        setSubClusters(clustersResponse.data.data || clustersResponse.data);
      } catch (e) {
        setSubClusters(null);
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
    
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: Math.min(Math.max(zoomLevel, 1), 18),
      animationDuration: 800,
    });
  }, []);

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
    setSelectedCategory('');
    
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
    setSelectedCategory('');
    
    animateToRegion(coords.latitude, coords.longitude, coords.latDelta, coords.lngDelta);
  }, [allItems, animateToRegion]);

  const resetToCountryView = useCallback(() => {
    setFilterMode('all');
    setActiveAreaFilter(null);
    setActiveAreaCoords(null);
    setCurrentRadiusKm(DEFAULT_RADIUS_KM);
    setFilteredItems(allItems);
    setViewMode('macro');
    setSelectedCategory('');
    setIsMapFilterActive(false);
    
    animateToRegion(countryCoords.latitude, countryCoords.longitude, countryCoords.latDelta, countryCoords.lngDelta);
  }, [allItems, countryCoords, animateToRegion]);

  // Handle map region change (debounced)
  // SKIP filtering when orbital bubbles are expanded or bottom sheet is visible
  const handleRegionDidChange = useCallback((feature: any) => {
    // Clear any pending timeout
    if (mapFilterTimeoutRef.current) {
      clearTimeout(mapFilterTimeoutRef.current);
    }
    
    const zoom = feature.properties?.zoomLevel || 0;
    setCurrentZoom(zoom);
    
    // IMPORTANT: Skip map filtering when in RPG interaction flow
    // (orbital bubbles, bottom sheet, place selection)
    if (isInRPGFlowRef.current) {
      return;
    }
    
    // Skip if in a specific filter mode (AI or nearMe controls these)
    if (filterMode === 'nearMe' || filterMode === 'area') {
      return;
    }
    
    // If zoomed out, show all places
    if (zoom < MIN_ZOOM_FOR_FILTERING) {
      if (isMapFilterActive) {
        setFilteredItems(allItems);
        setIsMapFilterActive(false);
        setActiveAreaFilter(null);
      }
      return;
    }
    
    // Debounce: wait 300ms after user stops moving
    mapFilterTimeoutRef.current = setTimeout(() => {
      const bounds = feature.properties?.visibleBounds;
      
      if (bounds && Array.isArray(bounds) && bounds.length === 2) {
        const visibleItems = filterItemsByMapBounds(allItems, bounds);
        
        // Update filter state based on visible items
        if (visibleItems.length > 0) {
          setFilteredItems(visibleItems);
          setIsMapFilterActive(true);
          setActiveAreaFilter(`${visibleItems.length} in view`);
        } else {
          // No places in view - keep showing but indicate empty
          setFilteredItems([]);
          setIsMapFilterActive(true);
          setActiveAreaFilter('0 in view');
        }
      }
    }, 300);
  }, [allItems, filterMode, isMapFilterActive]); // Using refs for expandedCategory/bottomSheetVisible to avoid stale closures

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (mapFilterTimeoutRef.current) {
        clearTimeout(mapFilterTimeoutRef.current);
      }
    };
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
  // BUBBLE GENERATION
  // ============================================================

  const macroBubbles = useMemo((): BubbleData[] => {
    // Always show main categories even with 0 counts (when filtering)
    // Only return empty if NO places saved at all
    if (allItems.length === 0) return [];

    // Get counts from filtered items (current view)
    const categoryGroups: Record<string, SavedItem[]> = {};
    items.forEach(item => {
      const cat = item.category || 'place';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(item);
    });

    // Also track what categories exist in ALL items (for structure)
    const allCategoryGroups: Record<string, SavedItem[]> = {};
    allItems.forEach(item => {
      const cat = item.category || 'place';
      if (!allCategoryGroups[cat]) allCategoryGroups[cat] = [];
      allCategoryGroups[cat].push(item);
    });

    const positions = [{ x: 30, y: 35 }, { x: 70, y: 48 }, { x: 50, y: 68 }];
    const mainCategories = ['food', 'activity', 'shopping'];
    const bubbles: BubbleData[] = [];

    mainCategories.forEach((cat, index) => {
      // Check if category has ANY items in allItems
      const allCatItems = [...(allCategoryGroups[cat] || [])];
      if (cat === 'activity') allCatItems.push(...(allCategoryGroups['place'] || []));
      
      // Only show bubble if category exists in trip (but count from filtered)
      if (allCatItems.length > 0) {
        const filteredCatItems = [...(categoryGroups[cat] || [])];
        if (cat === 'activity') filteredCatItems.push(...(categoryGroups['place'] || []));
        
        bubbles.push({
          id: `macro-${cat}`,
          label: cat.toUpperCase(),
          count: filteredCatItems.length, // Count from filtered items
          color: CATEGORY_COLORS[cat] || 'green',
          position: positions[index] || { x: 50, y: 50 },
          items: filteredCatItems,
          category: cat,
        });
      }
    });

    Object.entries(allCategoryGroups).forEach(([cat, allCatItems]) => {
      if (!mainCategories.includes(cat) && cat !== 'place' && allCatItems.length > 0) {
        const filteredCatItems = categoryGroups[cat] || [];
        bubbles.push({
          id: `macro-${cat}`,
          label: cat.toUpperCase(),
          count: filteredCatItems.length,
          color: CATEGORY_COLORS[cat] || 'purple',
          position: { x: 35 + Math.random() * 30, y: 55 + Math.random() * 20 },
          items: filteredCatItems,
          category: cat,
        });
      }
    });

    return bubbles;
  }, [items, allItems]);

  const microBubbles = useMemo((): BubbleData[] => {
      if (!items || items.length === 0 || !selectedCategory) return [];

      const categoryItems = items.filter(item => {
        const cat = item.category || 'place';
      if (selectedCategory === 'activity') return cat === 'activity' || cat === 'place';
        return cat === selectedCategory;
      });

      if (categoryItems.length === 0) return [];

      const subGroups: Record<string, SavedItem[]> = {};
      categoryItems.forEach(item => {
        const subType = String(item.cuisine_type || item.place_type || 'other');
        if (!subGroups[subType]) subGroups[subType] = [];
        subGroups[subType].push(item);
      });

    const positions = [{ x: 25, y: 28 }, { x: 72, y: 32 }, { x: 35, y: 52 }, { x: 68, y: 58 }, { x: 50, y: 75 }, { x: 28, y: 70 }];

      return Object.entries(subGroups)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 6)
        .map(([subType, subItems], index) => ({
          id: `micro-${subType || 'unknown'}`,
          label: String(subType || 'OTHER').toUpperCase(),
          count: subItems?.length || 0,
          color: SUBCATEGORY_COLORS[index % SUBCATEGORY_COLORS.length],
          position: positions[index] || { x: 50, y: 50 },
          items: subItems || [],
        }));
  }, [items, selectedCategory]);

  // Sub-categories for orbital explosion (computed for expanded category)
  const orbitalSubCategories = useMemo(() => {
    if (!expandedCategory || !items || items.length === 0) return [];

    const categoryItems = items.filter(item => {
      const cat = item.category || 'place';
      if (expandedCategory === 'activity') return cat === 'activity' || cat === 'place';
      return cat === expandedCategory;
    });

    if (categoryItems.length === 0) return [];

    const subGroups: Record<string, SavedItem[]> = {};
    categoryItems.forEach(item => {
      const subType = String(item.cuisine_type || item.place_type || 'other');
      if (!subGroups[subType]) subGroups[subType] = [];
      subGroups[subType].push(item);
    });

    return Object.entries(subGroups)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6)
      .map(([subType, subItems]) => ({
        id: `orbital-${subType || 'unknown'}`,
        label: String(subType || 'OTHER').toUpperCase(),
        count: subItems?.length || 0,
        items: subItems || [],
      }));
  }, [expandedCategory, items]);

  // ============================================================
  // HANDLERS
  // ============================================================

  // RPG-style: Tap macro bubble → orbital explosion (no navigation!)
  const handleMacroBubblePress = (bubble: BubbleData) => {
    if (bubble.category) {
      // IMMEDIATELY mark as in RPG flow to prevent map filtering
      isInRPGFlowRef.current = true;
      
      // Toggle expansion - if same category, collapse
      if (expandedCategory === bubble.category) {
        setExpandedCategory(null);
        isInRPGFlowRef.current = false; // Exiting RPG flow
      } else {
        setSelectedCategory(bubble.category);
        setExpandedCategory(bubble.category);
        setExpandedCategoryPosition(bubble.position);
      }
    }
  };

  // RPG-style: Tap sub-category → open bottom sheet (no navigation!)
  const handleSubCategoryPress = (subCategory: { id: string; label: string; count: number; items: SavedItem[] }) => {
    // IMMEDIATELY mark as in RPG flow to prevent map filtering
    isInRPGFlowRef.current = true;
    
    // Collapse orbital bubbles
    setExpandedCategory(null);
    
    // Get emoji for category
    const categoryEmojis: Record<string, string> = {
      food: '🍜', shopping: '🛍️', activity: '🎯',
    };
    
    // Open bottom sheet with items
    setBottomSheetItems(subCategory.items);
    setBottomSheetLabel(subCategory.label);
    setBottomSheetEmoji(categoryEmojis[selectedCategory] || '📍');
    setBottomSheetVisible(true);
    
    // Animate to 50% snap point
    setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 100);
  };

  // Collapse orbital bubbles - exit RPG flow
  const handleCollapseOrbit = () => {
    setExpandedCategory(null);
    isInRPGFlowRef.current = false;
  };

  // Ref to track if we're in fly-to animation (prevent scroll sync from interfering)
  const isAnimatingRef = useRef(false);
  
  // State for beacon/hero building highlight
  const [heroCoordinates, setHeroCoordinates] = useState<[number, number] | null>(null);
  
  // State for selected place (full object for HUD display)
  const [selectedPlace, setSelectedPlace] = useState<SavedItem | null>(null);
  
  // Track current bearing for 360° orbit
  const currentBearingRef = useRef(0);
  const [isOrbiting, setIsOrbiting] = useState(false);
  const isOrbitingRef = useRef(false); // Ref to avoid stale closures
  const heroCoordinatesRef = useRef<[number, number] | null>(null);

  // 360° CINEMATIC ORBIT - "Inspect" the building like in games
  const triggerOrbit = useCallback(() => {
    const coords = heroCoordinatesRef.current;
    if (isOrbitingRef.current || !cameraRef.current || !coords) {
      console.log('Orbit blocked:', { isOrbiting: isOrbitingRef.current, hasCamera: !!cameraRef.current, coords });
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
    
    // Majestic 360° spin around the building
    cameraRef.current.setCamera({
      centerCoordinate: coords,
      zoomLevel: 17.5,      // Closer for inspection
      pitch: 65,            // Dramatic tilt
      heading: targetBearing,
      animationDuration: 4000, // 4 seconds for full rotation
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

  // Calculate best viewing angle based on place position relative to map center
  const calculateBestBearing = useCallback((lng: number, lat: number): number => {
    // Calculate bearing that frames the building nicely
    // Rotate slightly based on longitude to add variety
    const baseBearing = ((lng * 10) % 60) - 30; // Range: -30 to 30
    return baseBearing;
  }, []);

  // Handle place selection from bottom sheet - CINEMATIC "LOCK-ON" fly-to!
  const handlePlaceSelect = useCallback((place: SavedItem) => {
    // 1. HAPTIC FEEDBACK - Physical "lock-on" feel
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setSelectedPlaceId(place.id);
    selectedPlaceIdRef.current = place.id;
    setSelectedPlace(place); // Store full place for HUD
    
    // Mark as animating
    isAnimatingRef.current = true;
    
    if (place.location_lat && place.location_lng && cameraRef.current) {
      const lng = place.location_lng;
      const lat = place.location_lat;
      
      // 2. SET HERO BEACON - Pillar of light at this location
      const coords: [number, number] = [lng, lat];
      setHeroCoordinates(coords);
      heroCoordinatesRef.current = coords; // Update ref for orbit
      
      // 3. Calculate best viewing angle
      const bestBearing = calculateBestBearing(lng, lat);
      
      // 4. PHASE 1: Quick pull-back for dramatic effect (200ms)
      cameraRef.current.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: 13,
        pitch: 20,
        heading: 0,
        animationDuration: 200,
      });
      
      // 5. PHASE 2: The GLIDE - Smooth curved flight path (800ms)
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        cameraRef.current?.setCamera({
          centerCoordinate: [lng, lat],
          zoomLevel: 15.5,
          pitch: 50,
          heading: bestBearing / 2,
          animationDuration: 600,
        });
      }, 250);
      
      // 6. PHASE 3: The LOCK-ON - Final position with RPG tilt (1200ms)
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        cameraRef.current?.setCamera({
          centerCoordinate: [lng, lat],
          zoomLevel: 16.5,      // Close enough for street details
          pitch: 70,            // RPG tilt - looking UP at building
          heading: bestBearing, // Calculated angle for best framing
          animationDuration: 1000,
        });
        // Track final bearing for orbit animation
        currentBearingRef.current = bestBearing;
      }, 900);
      
      // Clear animation flag after full animation
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 2200);
    }
  }, [calculateBestBearing]);

  // Handle scroll sync - pan camera to visible place (disabled during fly-to animation)
  const handlePlaceScroll = useCallback((place: SavedItem) => {
    // Don't interfere with fly-to animation or if a place is already selected
    // Using refs to avoid stale closure
    if (isAnimatingRef.current || selectedPlaceIdRef.current) {
      return;
    }
    
    if (place.location_lat && place.location_lng && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [place.location_lng, place.location_lat],
        zoomLevel: 14,
        pitch: 45,
        animationDuration: 500,
      });
    }
  }, []); // No deps needed - using refs

  // Close bottom sheet - return to orbital expansion (not fully close)
  const handleBottomSheetClose = () => {
    // Haptic feedback on close
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setBottomSheetVisible(false);
    setSelectedPlaceId(undefined);
    selectedPlaceIdRef.current = undefined;
    setSelectedPlace(null);
    
    // Clear the hero beacon
    setHeroCoordinates(null);
    heroCoordinatesRef.current = null;
    
    // Return to orbital expansion state (don't reset camera or clear expandedCategory)
    // User can tap backdrop of orbital to fully collapse back to macro bubbles
    if (selectedCategory) {
      // Re-expand the category orbital bubbles - stay in RPG flow
      setExpandedCategory(selectedCategory);
      isInRPGFlowRef.current = true;
    } else {
      // Exit RPG flow
      isInRPGFlowRef.current = false;
    }
    
    // Smooth zoom out with haptic
    cameraRef.current?.setCamera({
      zoomLevel: 12,
      pitch: 30,
      animationDuration: 600,
    });
    
    setTimeout(() => {
      cameraRef.current?.setCamera({
        zoomLevel: 10,
        pitch: 0,
        animationDuration: 400,
      });
    }, 650);
  };

  // Legacy handler for backward compatibility (still used by microBubbles)
  const handleMicroBubblePress = (bubble: BubbleData) => {
    handleSubCategoryPress({
      id: bubble.id,
      label: bubble.label,
      count: bubble.count,
      items: bubble.items || [],
    });
  };

  const handleBack = () => {
    // Close any open UI elements first
    if (bottomSheetVisible) {
      handleBottomSheetClose();
      return;
    }
    if (expandedCategory) {
      setExpandedCategory(null);
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Map Background - Mapbox */}
      <MapView
        style={styles.map}
        styleURL={MAPBOX_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        onRegionDidChange={handleRegionDidChange}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [countryCoords.longitude, countryCoords.latitude],
            zoomLevel: Math.log2(360 / Math.max(countryCoords.latDelta, 0.01)),
          }}
          minZoomLevel={1}
          maxZoomLevel={20}
          maxBounds={countryBounds ? {
            ne: [countryBounds.maxLng + 2, countryBounds.maxLat + 2],
            sw: [countryBounds.minLng - 2, countryBounds.minLat - 2],
          } : undefined}
        />
        
        {/* HERO BEACON - Pillar of Light at selected location */}
        {heroCoordinates && (
          <ShapeSource
            id="hero-beacon-source"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: heroCoordinates,
              },
              properties: {},
            }}
          >
            {/* Outer glow ring */}
            <CircleLayer
              id="hero-beacon-glow"
              style={{
                circleRadius: 40,
                circleColor: '#FF9900',
                circleOpacity: 0.3,
                circleBlur: 1,
              }}
            />
            {/* Inner bright core */}
            <CircleLayer
              id="hero-beacon-core"
              style={{
                circleRadius: 12,
                circleColor: '#FFCC00',
                circleOpacity: 0.9,
                circleStrokeWidth: 3,
                circleStrokeColor: '#FF9900',
              }}
            />
          </ShapeSource>
        )}
        
        {/* GO and ORBIT buttons are in the HUD (GameBottomSheet) - more reliable than MarkerView */}
      </MapView>

      {/* Gradient Overlay - Dark theme */}
      <LinearGradient
        colors={['rgba(10, 10, 26, 0.6)', 'rgba(10, 10, 26, 0.2)', 'rgba(10, 10, 26, 0.5)']}
        locations={[0, 0.5, 1]}
        style={styles.gradientOverlay}
        pointerEvents="none"
      />

      {/* Floating Clouds */}
      <FloatingCloud color="purple" size={200} position={{ x: 10, y: 5 }} delay={0} />
      <FloatingCloud color="blue" size={150} position={{ x: 80, y: 8 }} delay={1} />

      {/* Header */}
      <View style={styles.header}>
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <TouchableOpacity style={styles.countryHeader} onPress={handleBack}>
            <View style={styles.countryFlagContainer}>
              <Text style={styles.countryFlag}>{countryFlag}</Text>
            </View>
            <View>
              <Text style={styles.countryTitle}>{countryName}</Text>
              <Text style={styles.placeCount}>
                {filterMode !== 'all' ? `${items.length} places ${activeAreaFilter ? `in ${activeAreaFilter}` : `(${currentRadiusKm}km)`}` : `${items.length} places saved`}
              </Text>
            </View>
          </TouchableOpacity>
        </MotiView>

        {/* Filter Chip - shows for explicit filters OR map-based filtering */}
        {(filterMode !== 'all' || isMapFilterActive) && (
          <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.filterChipContainer}>
            <TouchableOpacity style={styles.filterChip} onPress={resetToCountryView} activeOpacity={0.8}>
              <Ionicons 
                name={isMapFilterActive ? "map" : "location"} 
                size={14} 
                color="#c4b5fd" 
              />
              <Text style={styles.filterChipText}>
                {activeAreaFilter || `${currentRadiusKm}km`}
              </Text>
              <Ionicons name="close-circle" size={16} color="#c4b5fd" />
            </TouchableOpacity>
          </MotiView>
        )}

        {/* Category indicator when orbital is expanded */}
        {expandedCategory && (
          <MotiView from={{ opacity: 0, translateY: -10 }} animate={{ opacity: 1, translateY: 0 }} style={styles.viewModeLabel}>
            <Text style={styles.viewModeLabelText}>
              {expandedCategory.toUpperCase()} • Tap a sub-category
            </Text>
          </MotiView>
        )}
      </View>

      {/* Navigation Buttons (Near Me / All Places) */}
      <View style={styles.navButtonsContainer}>
        <TouchableOpacity
          style={[styles.navButton, filterMode === 'nearMe' && styles.navButtonActive]}
          onPress={handleNearMePress}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={18} color={filterMode === 'nearMe' ? '#FFFFFF' : '#8B5CF6'} />
          <Text style={[styles.navButtonText, filterMode === 'nearMe' && styles.navButtonTextActive]}>Near Me</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.navButton, filterMode === 'all' && styles.navButtonActive]}
          onPress={resetToCountryView}
          activeOpacity={0.8}
        >
          <Ionicons name="globe-outline" size={18} color={filterMode === 'all' ? '#FFFFFF' : '#8B5CF6'} />
          <Text style={[styles.navButtonText, filterMode === 'all' && styles.navButtonTextActive]}>All Places</Text>
        </TouchableOpacity>
      </View>

      {/* Macro Bubbles - HIDDEN when bottom sheet is open */}
      {!bottomSheetVisible && (
        <View style={styles.bubblesContainer} pointerEvents="box-none">
          {!isLoading && macroBubbles.map((bubble, index) => (
            <MotiView
              key={bubble.id}
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: expandedCategory && expandedCategory !== bubble.category ? 0.3 : 1, 
                scale: expandedCategory === bubble.category ? 1.1 : 1 
              }}
              transition={{ type: 'spring', delay: index * 100, damping: 12 }}
            >
              <GlowingBubble
                label={bubble.label}
                count={bubble.count}
                color={bubble.color}
                size="large"
                position={bubble.position}
                delay={index}
                onPress={() => handleMacroBubblePress(bubble)}
              />
            </MotiView>
          ))}
        </View>
      )}

      {/* Orbital Sub-Categories - HIDDEN when bottom sheet is open */}
      {!bottomSheetVisible && (
        <OrbitalBubbles
          parentPosition={expandedCategoryPosition}
          parentLabel={expandedCategory?.toUpperCase() || ''}
          subCategories={orbitalSubCategories}
          isExpanded={!!expandedCategory}
          onSubCategoryPress={handleSubCategoryPress}
          onCollapse={handleCollapseOrbit}
          orbitRadius={110}
        />
      )}

      {/* Game Bottom Sheet - Places list with HUD mode */}
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
        onOrbit={triggerOrbit}
        isOrbiting={isOrbiting}
      />

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
      />

      {/* Loading */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading places...</Text>
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
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  map: { ...StyleSheet.absoluteFillObject },
  gradientOverlay: { ...StyleSheet.absoluteFillObject },
  
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  backButton: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
    borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  countryHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20,
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  countryFlagContainer: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  countryFlag: { fontSize: 24 },
  countryTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  placeCount: { fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2 },
  
  filterChipContainer: { marginTop: 12 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20,
    alignSelf: 'flex-start', gap: 8,
    borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  filterChipText: { fontSize: 14, fontWeight: '600', color: '#c4b5fd' },
  
  viewModeLabel: {
    marginTop: 12, backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, alignSelf: 'flex-start',
  },
  viewModeLabelText: { fontSize: 12, fontWeight: '600', color: '#c4b5fd' },
  
  navButtonsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 140 : 128,
    right: 16,
    flexDirection: 'column',
    gap: 8,
    zIndex: 15,
  },
  navButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20,
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  navButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#a78bfa',
  },
  navButtonText: { fontSize: 13, fontWeight: '600', color: '#c4b5fd' },
  navButtonTextActive: { color: '#FFFFFF' },
  
  bubblesContainer: { flex: 1, zIndex: 5 },
  
  emptyState: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', padding: 40, zIndex: 10,
  },
  emptyCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 24, padding: 32, alignItems: 'center',
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
    borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center' },
  resetButton: {
    marginTop: 16, backgroundColor: '#8B5CF6',
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12,
  },
  resetButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 26, 0.9)',
    justifyContent: 'center', alignItems: 'center', zIndex: 50,
  },
  loadingCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)', borderRadius: 20, padding: 32, alignItems: 'center',
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
    borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)',
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
});
