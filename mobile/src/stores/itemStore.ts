import { create } from 'zustand';
import api from '../config/api';
import {
  SavedItem,
  ItemCategory,
  ItemStatus,
  TagFilter,
  TagFacet,
  TagGroupItems,
  DayGroup,
} from '../types';

interface ItemState {
  items: SavedItem[];
  currentItem: SavedItem | null;
  isLoading: boolean;
  tagFacets: TagFacet[];
  groupedItems: TagGroupItems[];
  dayGroups: DayGroup[];  // For day planner view
  
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
  toggleFavorite: (itemId: string) => Promise<SavedItem>;
  toggleMustVisit: (itemId: string) => Promise<SavedItem>;
  updateNotes: (itemId: string, notes: string) => Promise<SavedItem>;
  // Day planner actions
  fetchItemsByDay: (tripId: string) => Promise<DayGroup[]>;
  assignItemToDay: (itemId: string, day: number | null) => Promise<SavedItem>;
  reorderItemsInDay: (tripId: string, day: number | null, itemIds: string[]) => Promise<void>;
  setItems: (items: SavedItem[]) => void;
  clearItems: () => void;
}

export const useItemStore = create<ItemState>((set, get) => ({
  items: [],
  currentItem: null,
  isLoading: false,
  tagFacets: [],
  groupedItems: [],
  dayGroups: [],

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

  toggleFavorite: async (itemId) => {
    try {
      const response = await api.patch<{ data: SavedItem }>(`/items/${itemId}/favorite`);
      const updatedItem = response.data.data;
      
      // Update local state
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, is_favorite: updatedItem.is_favorite } : item
        ),
        currentItem:
          state.currentItem?.id === itemId
            ? { ...state.currentItem, is_favorite: updatedItem.is_favorite }
            : state.currentItem,
      }));
      
      return updatedItem;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to toggle favorite');
    }
  },

  toggleMustVisit: async (itemId) => {
    try {
      const response = await api.patch<{ data: SavedItem }>(`/items/${itemId}/must-visit`);
      const updatedItem = response.data.data;
      
      // Update local state
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, is_must_visit: updatedItem.is_must_visit } : item
        ),
        currentItem:
          state.currentItem?.id === itemId
            ? { ...state.currentItem, is_must_visit: updatedItem.is_must_visit }
            : state.currentItem,
      }));
      
      return updatedItem;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to toggle must-visit');
    }
  },

  updateNotes: async (itemId, notes) => {
    try {
      const response = await api.patch<{ data: SavedItem }>(`/items/${itemId}/notes`, { notes });
      const updatedItem = response.data.data;
      
      // Update local state
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, user_notes: updatedItem.user_notes } : item
        ),
        currentItem:
          state.currentItem?.id === itemId
            ? { ...state.currentItem, user_notes: updatedItem.user_notes }
            : state.currentItem,
      }));
      
      return updatedItem;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update notes');
    }
  },

  // Day planner actions
  fetchItemsByDay: async (tripId) => {
    set({ isLoading: true });
    try {
      const response = await api.get<{ data: DayGroup[] }>(`/trips/${tripId}/items/by-day`);
      const dayGroups = response.data.data;
      
      console.log(`[ItemStore] Fetched ${dayGroups.length} day groups`);
      
      set({ dayGroups, isLoading: false });
      return dayGroups;
    } catch (error) {
      console.error('Fetch items by day error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  assignItemToDay: async (itemId, day) => {
    try {
      const response = await api.patch<{ data: SavedItem }>(`/items/${itemId}/assign-day`, { day });
      const updatedItem = response.data.data;
      
      // Update local items state
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId 
            ? { ...item, planned_day: updatedItem.planned_day, day_order: updatedItem.day_order } 
            : item
        ),
        currentItem:
          state.currentItem?.id === itemId
            ? { ...state.currentItem, planned_day: updatedItem.planned_day, day_order: updatedItem.day_order }
            : state.currentItem,
      }));
      
      return updatedItem;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to assign item to day');
    }
  },

  reorderItemsInDay: async (tripId, day, itemIds) => {
    try {
      await api.patch(`/trips/${tripId}/items/reorder`, { day, itemIds });
      
      // Update local dayGroups state with new order
      set((state) => {
        const newDayGroups = state.dayGroups.map((group) => {
          if (group.day === day) {
            // Reorder items based on itemIds array
            const reorderedItems = itemIds
              .map((id, index) => {
                const item = group.items.find((i) => i.id === id);
                return item ? { ...item, day_order: index, planned_day: day } : null;
              })
              .filter((item): item is SavedItem => item !== null);
            return { ...group, items: reorderedItems };
          }
          return group;
        });
        return { dayGroups: newDayGroups };
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to reorder items');
    }
  },

  setItems: (items) => {
    set({ items });
  },

  clearItems: () => {
    set({ items: [], currentItem: null, tagFacets: [], groupedItems: [], dayGroups: [] });
  },
}));
