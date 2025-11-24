import { create } from 'zustand';
import api from '../config/api';
import {
  SavedItem,
  ItemCategory,
  ItemStatus,
  TagFilter,
  TagFacet,
  TagGroupItems,
} from '../types';

interface ItemState {
  items: SavedItem[];
  currentItem: SavedItem | null;
  isLoading: boolean;
  tagFacets: TagFacet[];
  groupedItems: TagGroupItems[];
  
  // Actions
  fetchTripItems: (
    tripId: string,
    filters?: {
      category?: ItemCategory;
      status?: ItemStatus;
      tags?: TagFilter[];
    }
  ) => Promise<SavedItem[]>;
  fetchTagFacets: (
    tripId: string,
    filters?: {
      category?: ItemCategory;
      top?: number;
    }
  ) => Promise<TagFacet[]>;
  fetchItemsGroupedByTag: (
    tripId: string,
    group: string,
    options?: {
      category?: ItemCategory;
      tagValues?: string[];
      limitPerTag?: number;
    }
  ) => Promise<TagGroupItems[]>;
  fetchItemDetails: (itemId: string) => Promise<void>;
  searchItems: (tripId: string, query: string) => Promise<void>;
  markAsVisited: (itemId: string, notes?: string) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  setItems: (items: SavedItem[]) => void;
  clearItems: () => void;
}

export const useItemStore = create<ItemState>((set, get) => ({
  items: [],
  currentItem: null,
  isLoading: false,
  tagFacets: [],
  groupedItems: [],

  fetchTripItems: async (tripId, filters) => {
    set({ isLoading: true });
    try {
      const params: Record<string, any> = {};
      if (filters?.category) params.category = filters.category;
      if (filters?.status) params.status = filters.status;
      if (filters?.tags && filters.tags.length > 0) {
        params.tags = filters.tags.map((tag) => `${tag.group}:${tag.value}`);
      }

      const response = await api.get<{ data: SavedItem[] }>(`/trips/${tripId}/items`, {
        params,
      });
      
      // Log enrichment data
      const items = response.data.data;
      console.log(`[ItemStore] Fetched ${items.length} items`);
      const enriched = items.filter(i => i.google_place_id);
      console.log(`[ItemStore] ${enriched.length} items have Google enrichment`);
      if (items.length > 0) {
        const sample = items[0];
        console.log(`[ItemStore] Sample item fields:`, {
          name: sample.name,
          hasRating: !!sample.rating,
          rating: sample.rating,
          hasArea: !!sample.area_name,
          area: sample.area_name,
          hasPhotos: !!sample.photos_json,
        });
      }
      
      set({ items, isLoading: false });
      return items;
    } catch (error) {
      console.error('Fetch items error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  fetchTagFacets: async (tripId, filters) => {
    try {
      const params: Record<string, any> = {};
      if (filters?.category) params.category = filters.category;
      if (filters?.top) params.top = filters.top;

      const response = await api.get<{ data: TagFacet[] }>(
        `/trips/${tripId}/items/facets`,
        { params }
      );

      set({ tagFacets: response.data.data });
      return response.data.data;
    } catch (error) {
      console.error('Fetch tag facets error:', error);
      set({ tagFacets: [] });
      throw error;
    }
  },

  fetchItemsGroupedByTag: async (tripId, group, options) => {
    try {
      const params: Record<string, any> = { group };
      if (options?.category) params.category = options.category;
      if (options?.tagValues && options.tagValues.length > 0) {
        params.values = options.tagValues.join(',');
      }
      if (options?.limitPerTag) params.limitPerTag = options.limitPerTag;

      const response = await api.get<{ data: TagGroupItems[] }>(
        `/trips/${tripId}/items/grouped`,
        { params }
      );

      set({ groupedItems: response.data.data });
      return response.data.data;
    } catch (error) {
      console.error('Fetch grouped items error:', error);
      set({ groupedItems: [] });
      throw error;
    }
  },

  fetchItemDetails: async (itemId) => {
    set({ isLoading: true });
    try {
      const response = await api.get<{ data: SavedItem }>(`/items/${itemId}`);
      set({ currentItem: response.data.data, isLoading: false });
    } catch (error) {
      console.error('Fetch item details error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  searchItems: async (tripId, query) => {
    set({ isLoading: true });
    try {
      const response = await api.get<{ data: SavedItem[] }>(
        `/trips/${tripId}/search?q=${encodeURIComponent(query)}`
      );
      set({ items: response.data.data, isLoading: false });
    } catch (error) {
      console.error('Search items error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  markAsVisited: async (itemId, notes) => {
    try {
      await api.post(`/items/${itemId}/visit`, { notes });
      
      // Update local state
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, status: ItemStatus.VISITED } : item
        ),
        currentItem:
          state.currentItem?.id === itemId
            ? { ...state.currentItem, status: ItemStatus.VISITED }
            : state.currentItem,
      }));
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to mark as visited');
    }
  },

  deleteItem: async (itemId) => {
    try {
      await api.delete(`/items/${itemId}`);
      
      set((state) => ({
        items: state.items.filter((item) => item.id !== itemId),
        currentItem: state.currentItem?.id === itemId ? null : state.currentItem,
      }));
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete item');
    }
  },

  setItems: (items) => {
    set({ items });
  },

  clearItems: () => {
    set({ items: [], currentItem: null, tagFacets: [], groupedItems: [] });
  },
}));
