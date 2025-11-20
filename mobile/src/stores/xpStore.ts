import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface XPState {
  xp: number;
  level: number;
  
  // Actions
  addXP: (amount: number) => void;
  loadStoredXP: () => Promise<void>;
  getLevel: () => number;
  getProgress: () => number; // 0-100
  getLevelTitle: () => string;
}

const XP_PER_LEVEL = 100;

const LEVEL_TITLES = [
  'Tourist',
  'Explorer',
  'Adventurer',
  'Wanderer',
  'Globe Trotter',
  'Travel Pro',
  'Local Legend',
  'World Traveler',
];

export const useXPStore = create<XPState>((set, get) => ({
  xp: 0,
  level: 1,

  addXP: async (amount: number) => {
    const currentXP = get().xp;
    const newXP = currentXP + amount;
    const newLevel = Math.floor(newXP / XP_PER_LEVEL) + 1;
    
    set({ xp: newXP, level: newLevel });
    
    // Persist to storage
    await AsyncStorage.setItem('userXP', newXP.toString());
    await AsyncStorage.setItem('userLevel', newLevel.toString());
  },

  loadStoredXP: async () => {
    try {
      const [storedXP, storedLevel] = await Promise.all([
        AsyncStorage.getItem('userXP'),
        AsyncStorage.getItem('userLevel'),
      ]);
      
      if (storedXP && storedLevel) {
        set({
          xp: parseInt(storedXP, 10),
          level: parseInt(storedLevel, 10),
        });
      }
    } catch (error) {
      console.error('Failed to load XP:', error);
    }
  },

  getLevel: () => {
    return get().level;
  },

  getProgress: () => {
    const { xp, level } = get();
    const xpInCurrentLevel = xp % XP_PER_LEVEL;
    return (xpInCurrentLevel / XP_PER_LEVEL) * 100;
  },

  getLevelTitle: () => {
    const { level } = get();
    return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] || 'World Traveler';
  },
}));

// XP Rewards
export const XP_REWARDS = {
  ADD_PLACE: 10,
  VISIT_PLACE: 50,
  PASTE_LINK: 5,
  CREATE_TRIP: 25,
};

