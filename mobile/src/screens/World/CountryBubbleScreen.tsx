/**
 * Country Bubble Screen - V3 with AI-Powered Location Filtering
 * 
 * Features:
 * - Interactive Google Map background
 * - AI Chat that understands location queries
 * - "Take me to Bangkok" → Map animates + bubbles filter
 * - Area filter chip shows active filter
 * - "Show everything" resets to full country view
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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import api from '../../config/api';
import { SavedItem, ItemCategory, SubClusters } from '../../types';
import { FloatingCloud, GlowingBubble } from '../../components/bubbles';
import { FloatingAIOrb } from '../../components/FloatingAIOrb';
import { CompactAIChat } from '../../components/CompactAIChat';
import { useCompanionStore } from '../../stores/companionStore';
import { useLocationStore } from '../../stores/locationStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================
// CITY/AREA COORDINATES DATABASE
// ============================================================
interface CityCoords {
  latitude: number;
  longitude: number;
  latDelta: number;
  lngDelta: number;
  aliases?: string[]; // Alternative names for matching
}

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

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d6ff' }] },
];

type ViewMode = 'macro' | 'micro';

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
// LOCATION DETECTION HELPERS
// ============================================================

/**
 * Detect if message is asking about a location and extract the city/area
 */
function detectLocationQuery(message: string, countryName: string): { isLocationQuery: boolean; location: string | null; coords: CityCoords | null } {
  const lowerMessage = message.toLowerCase().trim();
  const lowerCountry = countryName.toLowerCase();
  
  // Check for "show everything" / reset commands
  const resetPhrases = ['show everything', 'show all', 'all places', 'entire country', 'whole country', 'reset', 'zoom out', 'back to all'];
  if (resetPhrases.some(phrase => lowerMessage.includes(phrase))) {
    return { isLocationQuery: true, location: null, coords: null };
  }
  
  // Location trigger phrases
  const locationTriggers = [
    'take me to', 'show me', 'go to', 'places in', 'spots in', 'food in', 
    'things in', 'what\'s in', 'whats in', 'explore', 'visit', 'around',
    'near', 'in the', 'at the'
  ];
  
  const hasLocationTrigger = locationTriggers.some(trigger => lowerMessage.includes(trigger));
  
  // Get cities for this country
  const countryCities = CITY_COORDS[lowerCountry] || {};
  
  // Try to match a city/area
  for (const [cityKey, cityData] of Object.entries(countryCities)) {
    const searchTerms = [cityKey, ...(cityData.aliases || [])];
    
    for (const term of searchTerms) {
      // Check if message contains this city name
      const termLower = term.toLowerCase();
      if (lowerMessage.includes(termLower)) {
        // Found a location match!
        const displayName = cityKey.charAt(0).toUpperCase() + cityKey.slice(1);
        return { isLocationQuery: true, location: displayName, coords: cityData };
      }
    }
  }
  
  // If has trigger but no city found, might be a general location question
  if (hasLocationTrigger) {
    return { isLocationQuery: true, location: null, coords: null };
  }
  
  return { isLocationQuery: false, location: null, coords: null };
}

/**
 * Filter items by proximity to coordinates or matching area_name
 */
function filterItemsByLocation(items: SavedItem[], location: string, coords: CityCoords): SavedItem[] {
  const locationLower = location.toLowerCase();
  
  return items.filter(item => {
    // Check area_name match
    if (item.area_name) {
      const areaLower = item.area_name.toLowerCase();
      if (areaLower.includes(locationLower) || locationLower.includes(areaLower)) {
        return true;
      }
    }
    
    // Check location_name match
    if (item.location_name) {
      const locNameLower = item.location_name.toLowerCase();
      if (locNameLower.includes(locationLower)) {
        return true;
      }
    }
    
    // Check proximity (if item has coordinates)
    if (item.location_lat && item.location_lng) {
      const distance = getDistanceKm(
        coords.latitude, coords.longitude,
        item.location_lat, item.location_lng
      );
      // Include items within reasonable radius based on zoom level
      const radiusKm = Math.max(coords.latDelta, coords.lngDelta) * 50; // Rough km conversion
      if (distance <= radiusKm) {
        return true;
      }
    }
    
    return false;
  });
}

/**
 * Calculate distance between two points in km (Haversine formula)
 */
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function CountryBubbleScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const mapRef = useRef<MapView>(null);
  
  const params = route.params || {};
  const tripId = params.tripId || '';
  const countryName = params.countryName || 'Unknown';

  // Data state
  const [isLoading, setIsLoading] = useState(true);
  const [allItems, setAllItems] = useState<SavedItem[]>([]); // All items (unfiltered)
  const [filteredItems, setFilteredItems] = useState<SavedItem[]>([]); // Filtered by area
  const [subClusters, setSubClusters] = useState<SubClusters | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('macro');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Area filter state
  const [activeAreaFilter, setActiveAreaFilter] = useState<string | null>(null);
  const [activeAreaCoords, setActiveAreaCoords] = useState<CityCoords | null>(null);

  // Compact Chat state
  const [isCompactChatOpen, setIsCompactChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      type: 'ai',
      content: `Hey there! 👋 I'm your travel buddy for ${countryName}.\n\nTry: "Take me to ${countryName === 'Japan' ? 'Shibuya' : countryName === 'Thailand' ? 'Bangkok' : 'the city'}"`,
      timestamp: new Date(),
    }
  ]);
  const [isAITyping, setIsAITyping] = useState(false);

  // Stores
  const { sendQuery, isLoading: companionLoading, getMessages } = useCompanionStore();
  const { location } = useLocationStore();

  const countryCoords = COUNTRY_COORDS[countryName.toLowerCase()] || COUNTRY_COORDS.default;
  const countryFlag = COUNTRY_FLAGS[countryName.toLowerCase()] || '🌍';

  // Use filtered items for bubbles
  const items = filteredItems;

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
      setFilteredItems(fetchedItems); // Initially show all

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

  // ============================================================
  // MAP & FILTER HANDLERS
  // ============================================================

  const animateToLocation = useCallback((coords: CityCoords) => {
    mapRef.current?.animateToRegion({
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: coords.latDelta,
      longitudeDelta: coords.lngDelta,
    }, 800);
  }, []);

  const resetToCountryView = useCallback(() => {
    setActiveAreaFilter(null);
    setActiveAreaCoords(null);
    setFilteredItems(allItems);
    setViewMode('macro');
    setSelectedCategory('');
    
    mapRef.current?.animateToRegion({
      latitude: countryCoords.latitude,
      longitude: countryCoords.longitude,
      latitudeDelta: countryCoords.latDelta,
      longitudeDelta: countryCoords.lngDelta,
    }, 800);
  }, [allItems, countryCoords]);

  const applyAreaFilter = useCallback((location: string, coords: CityCoords) => {
    setActiveAreaFilter(location);
    setActiveAreaCoords(coords);
    
    // Filter items
    const filtered = filterItemsByLocation(allItems, location, coords);
    setFilteredItems(filtered);
    
    // Reset to macro view with filtered data
    setViewMode('macro');
    setSelectedCategory('');
    
    // Animate map
    animateToLocation(coords);
  }, [allItems, animateToLocation]);

  // ============================================================
  // BUBBLE GENERATION (uses filtered items)
  // ============================================================

  const macroBubbles = useMemo((): BubbleData[] => {
    if (items.length === 0) return [];

    const categoryGroups: Record<string, SavedItem[]> = {};
    items.forEach(item => {
      const cat = item.category || 'place';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(item);
    });

    const positions = [
      { x: 30, y: 35 },
      { x: 70, y: 48 },
      { x: 50, y: 68 },
    ];

    const mainCategories = ['food', 'activity', 'shopping'];
    const bubbles: BubbleData[] = [];

    mainCategories.forEach((cat, index) => {
      const catItems = [...(categoryGroups[cat] || [])];
      if (cat === 'activity') {
        const placeItems = categoryGroups['place'] || [];
        catItems.push(...placeItems);
      }
      
      if (catItems.length > 0) {
        bubbles.push({
          id: `macro-${cat}`,
          label: cat.toUpperCase(),
          count: catItems.length,
          color: CATEGORY_COLORS[cat] || 'green',
          position: positions[index] || { x: 50, y: 50 },
          items: catItems,
          category: cat,
        });
      }
    });

    Object.entries(categoryGroups).forEach(([cat, catItems]) => {
      if (!mainCategories.includes(cat) && cat !== 'place' && catItems.length > 0) {
        bubbles.push({
          id: `macro-${cat}`,
          label: cat.toUpperCase(),
          count: catItems.length,
          color: CATEGORY_COLORS[cat] || 'purple',
          position: { x: 35 + Math.random() * 30, y: 55 + Math.random() * 20 },
          items: catItems,
          category: cat,
        });
      }
    });

    return bubbles;
  }, [items]);

  const microBubbles = useMemo((): BubbleData[] => {
    try {
      if (!items || items.length === 0 || !selectedCategory) return [];

      const categoryItems = items.filter(item => {
        if (!item) return false;
        const cat = item.category || 'place';
        if (selectedCategory === 'activity') {
          return cat === 'activity' || cat === 'place';
        }
        return cat === selectedCategory;
      });

      if (categoryItems.length === 0) return [];

      const subGroups: Record<string, SavedItem[]> = {};
      categoryItems.forEach(item => {
        const subType = String(item.cuisine_type || item.place_type || 'other');
        if (!subGroups[subType]) subGroups[subType] = [];
        subGroups[subType].push(item);
      });

      const positions = [
        { x: 25, y: 28 }, { x: 72, y: 32 }, { x: 35, y: 52 },
        { x: 68, y: 58 }, { x: 50, y: 75 }, { x: 28, y: 70 },
      ];

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
    } catch (error) {
      return [];
    }
  }, [items, selectedCategory]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleMacroBubblePress = (bubble: BubbleData) => {
    if (bubble.category) {
      setSelectedCategory(bubble.category);
      setViewMode('micro');
    }
  };

  const handleMicroBubblePress = (bubble: BubbleData) => {
    const simplifiedItems = (bubble.items || []).map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      location_name: item.location_name,
      location_lat: item.location_lat,
      location_lng: item.location_lng,
      rating: item.rating,
      user_ratings_total: item.user_ratings_total,
      cuisine_type: item.cuisine_type,
      place_type: item.place_type,
      area_name: item.area_name,
      google_place_id: item.google_place_id,
      photos_json: item.photos_json ? 
        (typeof item.photos_json === 'string' ? item.photos_json : JSON.stringify(item.photos_json?.slice?.(0, 1) || [])) 
        : null,
    }));
    
    navigation.navigate('CategoryList', {
      tripId,
      countryName,
      categoryLabel: bubble.label || 'Places',
      categoryType: selectedCategory || 'place',
      items: simplifiedItems,
      areaFilter: activeAreaFilter, // Pass area filter to CategoryList
    });
  };

  const handleBack = () => {
    if (viewMode === 'micro') {
      setViewMode('macro');
      setSelectedCategory('');
    } else {
      navigation.goBack();
    }
  };

  // ============================================================
  // COMPACT CHAT HANDLERS
  // ============================================================

  const handleOrbPress = () => {
    setIsCompactChatOpen(true);
  };

  const handleCloseCompactChat = () => {
    setIsCompactChatOpen(false);
    Keyboard.dismiss();
  };

  const handleOpenFullChat = () => {
    setIsCompactChatOpen(false);
    navigation.navigate('AgentChat', { tripId, countryName });
  };

  const handleSendMessage = async (message: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMessage]);

    // Detect location query FIRST
    const { isLocationQuery, location: detectedLocation, coords } = detectLocationQuery(message, countryName);

    if (isLocationQuery) {
      if (detectedLocation && coords) {
        // Apply area filter and animate map
        applyAreaFilter(detectedLocation, coords);
        
        // Count items in that area
        const areaItems = filterItemsByLocation(allItems, detectedLocation, coords);
        
        // Add AI response about the location
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          type: 'ai',
          content: `📍 Moving to ${detectedLocation}!\n\nFound ${areaItems.length} places here. ${areaItems.length > 0 ? 'Explore the bubbles!' : 'Try adding more places for this area.'}`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, aiMessage]);
        return;
      } else if (detectedLocation === null && coords === null) {
        // Reset command
        resetToCountryView();
        
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          type: 'ai',
          content: `🗺️ Showing all ${allItems.length} places in ${countryName}!`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, aiMessage]);
        return;
      }
    }

    // If not a location query, send to AI backend
    setIsAITyping(true);

    try {
      const locationData = location
        ? { lat: location.coords.latitude, lng: location.coords.longitude }
        : undefined;

      await sendQuery(tripId, message, locationData);
      
      const storeMessages = getMessages(tripId);
      const latestAIMessage = storeMessages.filter(m => m.type === 'companion').pop();
      
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        type: 'ai',
        content: latestAIMessage?.content || "I found some great places! Tap expand to see details 🗺️",
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        type: 'ai',
        content: "Oops! Something went wrong. Try again? 😅",
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAITyping(false);
    }
  };

  const currentBubbles = viewMode === 'macro' ? macroBubbles : microBubbles;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Map Background */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: countryCoords.latitude,
          longitude: countryCoords.longitude,
          latitudeDelta: countryCoords.latDelta,
          longitudeDelta: countryCoords.lngDelta,
        }}
        customMapStyle={MAP_STYLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
      />

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.5)']}
        locations={[0, 0.5, 1]}
        style={styles.gradientOverlay}
        pointerEvents="none"
      />

      {/* Floating Clouds */}
      <FloatingCloud color="purple" size={200} position={{ x: 10, y: 5 }} delay={0} />
      <FloatingCloud color="blue" size={150} position={{ x: 80, y: 8 }} delay={1} />

      {/* Header */}
      <View style={styles.header}>
        {viewMode === 'micro' ? (
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
          >
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color="#374151" />
            </TouchableOpacity>
          </MotiView>
        ) : (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TouchableOpacity style={styles.countryHeader} onPress={handleBack}>
              <View style={styles.countryFlagContainer}>
                <Text style={styles.countryFlag}>{countryFlag}</Text>
              </View>
              <View>
                <Text style={styles.countryTitle}>{countryName}</Text>
                <Text style={styles.placeCount}>
                  {activeAreaFilter 
                    ? `${items.length} places in ${activeAreaFilter}`
                    : `${items.length} places saved`
                  }
                </Text>
              </View>
            </TouchableOpacity>
          </MotiView>
        )}

        {/* Active Area Filter Chip */}
        {activeAreaFilter && viewMode === 'macro' && (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={styles.filterChipContainer}
          >
            <TouchableOpacity 
              style={styles.filterChip}
              onPress={resetToCountryView}
              activeOpacity={0.8}
            >
              <Ionicons name="location" size={14} color="#8B5CF6" />
              <Text style={styles.filterChipText}>{activeAreaFilter}</Text>
              <Ionicons name="close-circle" size={16} color="#8B5CF6" />
            </TouchableOpacity>
          </MotiView>
        )}

        {viewMode === 'micro' && selectedCategory && (
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={styles.viewModeLabel}
          >
            <Text style={styles.viewModeLabelText}>
              {selectedCategory.toUpperCase()} • {microBubbles.length} types
              {activeAreaFilter ? ` in ${activeAreaFilter}` : ''}
            </Text>
          </MotiView>
        )}
      </View>

      {/* Bubbles */}
      <View style={styles.bubblesContainer} pointerEvents="box-none">
        {!isLoading && currentBubbles.map((bubble, index) => (
          <MotiView
            key={bubble.id}
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: index * 100, damping: 12 }}
          >
            <GlowingBubble
              label={bubble.label}
              count={bubble.count}
              color={bubble.color}
              size={viewMode === 'macro' ? 'large' : 'small'}
              position={bubble.position}
              delay={index}
              onPress={() => viewMode === 'macro' 
                ? handleMacroBubblePress(bubble)
                : handleMicroBubblePress(bubble)
              }
            />
          </MotiView>
        ))}
      </View>

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={styles.emptyState}
        >
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>{activeAreaFilter ? '📍' : '🗺️'}</Text>
            <Text style={styles.emptyTitle}>
              {activeAreaFilter ? `No places in ${activeAreaFilter}` : 'No places yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeAreaFilter 
                ? `Try another area or say "show everything"`
                : `Share videos about ${countryName} to add places`
              }
            </Text>
            {activeAreaFilter && (
              <TouchableOpacity 
                style={styles.resetButton}
                onPress={resetToCountryView}
              >
                <Text style={styles.resetButtonText}>Show All Places</Text>
              </TouchableOpacity>
            )}
          </View>
        </MotiView>
      )}

      {/* Floating AI Orb */}
      <FloatingAIOrb
        onPress={handleOrbPress}
        visible={!isCompactChatOpen}
      />

      {/* Compact AI Chat */}
      <CompactAIChat
        isOpen={isCompactChatOpen}
        onClose={handleCloseCompactChat}
        onOpenFullChat={handleOpenFullChat}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isTyping={isAITyping || companionLoading}
      />

      {/* Loading overlay */}
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
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 10,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  countryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    alignSelf: 'flex-start',
  },
  countryFlagContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  countryFlag: {
    fontSize: 24,
  },
  countryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeCount: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  filterChipContainer: {
    marginTop: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  viewModeLabel: {
    marginTop: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  viewModeLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  bubblesContainer: {
    flex: 1,
    zIndex: 5,
  },
  emptyState: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    zIndex: 10,
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  resetButton: {
    marginTop: 16,
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 16,
  },
});
