import { TripGroupModel } from '../models/tripGroup.model';
import { TripGroup } from '../types';
import logger from '../config/logger';

export class TripGroupService {
  /**
   * Create a new trip group
   */
  static async createTrip(
    userId: string,
    name: string,
    destination: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TripGroup> {
    try {
      const trip = await TripGroupModel.create(
        name,
        destination,
        userId,
        startDate,
        endDate
      );

      logger.info(`Trip created: ${trip.id} by user ${userId}`);
      return trip;
    } catch (error) {
      logger.error('Error creating trip:', error);
      throw new Error('Failed to create trip');
    }
  }

  /**
   * Get user's trips
   */
  static async getUserTrips(userId: string): Promise<TripGroup[]> {
    try {
      return await TripGroupModel.findByUser(userId);
    } catch (error) {
      logger.error('Error fetching user trips:', error);
      throw new Error('Failed to fetch trips');
    }
  }

  /**
   * Get trip details
   */
  static async getTripDetails(tripId: string, userId: string): Promise<TripGroup> {
    try {
      const trip = await TripGroupModel.findById(tripId);

      if (!trip) {
        throw new Error('Trip not found');
      }

      // Check if user is a member
      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      return trip;
    } catch (error: any) {
      logger.error('Error fetching trip details:', error);
      throw error;
    }
  }

  /**
   * Update trip
   */
  static async updateTrip(
    tripId: string,
    userId: string,
    updates: Partial<Pick<TripGroup, 'name' | 'destination' | 'start_date' | 'end_date'>>
  ): Promise<TripGroup> {
    try {
      // Check if user is owner
      const isOwner = await TripGroupModel.isOwner(tripId, userId);
      if (!isOwner) {
        throw new Error('Only trip owner can update trip details');
      }

      const trip = await TripGroupModel.update(tripId, updates);
      if (!trip) {
        throw new Error('Trip not found');
      }

      logger.info(`Trip updated: ${tripId} by user ${userId}`);
      return trip;
    } catch (error: any) {
      logger.error('Error updating trip:', error);
      throw error;
    }
  }

  /**
   * Delete trip
   */
  static async deleteTrip(tripId: string, userId: string): Promise<void> {
    try {
      // Check if user is owner
      const isOwner = await TripGroupModel.isOwner(tripId, userId);
      if (!isOwner) {
        throw new Error('Only trip owner can delete the trip');
      }

      const deleted = await TripGroupModel.delete(tripId);
      if (!deleted) {
        throw new Error('Trip not found');
      }

      logger.info(`Trip deleted: ${tripId} by user ${userId}`);
    } catch (error: any) {
      logger.error('Error deleting trip:', error);
      throw error;
    }
  }

  /**
   * Join trip via invite code
   */
  static async joinTrip(userId: string, inviteCode: string): Promise<TripGroup> {
    try {
      const trip = await TripGroupModel.findByInviteCode(inviteCode);

      if (!trip) {
        throw new Error('Invalid invite code');
      }

      // Check if already a member
      const isMember = await TripGroupModel.isMember(trip.id, userId);
      if (isMember) {
        throw new Error('Already a member of this trip');
      }

      // Add as member
      await TripGroupModel.addMember(trip.id, userId);

      logger.info(`User ${userId} joined trip ${trip.id}`);
      return trip;
    } catch (error: any) {
      logger.error('Error joining trip:', error);
      throw error;
    }
  }

  /**
   * Leave trip
   */
  static async leaveTrip(tripId: string, userId: string): Promise<void> {
    try {
      // Check if user is member
      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        throw new Error('Not a member of this trip');
      }

      // Check if user is owner
      const isOwner = await TripGroupModel.isOwner(tripId, userId);
      if (isOwner) {
        throw new Error('Trip owner cannot leave. Please transfer ownership or delete the trip.');
      }

      const removed = await TripGroupModel.removeMember(tripId, userId);
      if (!removed) {
        throw new Error('Failed to leave trip');
      }

      logger.info(`User ${userId} left trip ${tripId}`);
    } catch (error: any) {
      logger.error('Error leaving trip:', error);
      throw error;
    }
  }

  /**
   * Get trip members
   */
  static async getTripMembers(tripId: string, userId: string): Promise<any[]> {
    try {
      // Check if user is member
      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      return await TripGroupModel.getMembers(tripId);
    } catch (error: any) {
      logger.error('Error fetching trip members:', error);
      throw error;
    }
  }

  /**
   * Get invite information
   */
  static async getInviteInfo(tripId: string, userId: string): Promise<any> {
    try {
      // Check if user is member
      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      const trip = await TripGroupModel.findById(tripId);
      if (!trip) {
        throw new Error('Trip not found');
      }

      // Generate share link (you'd customize this with your app's deep link)
      const shareLink = `https://travelagent.app/join/${trip.invite_code}`;

      return {
        inviteCode: trip.invite_code,
        shareLink: shareLink,
      };
    } catch (error: any) {
      logger.error('Error getting invite info:', error);
      throw error;
    }
  }

  /**
   * Update trip banner
   */
  static async updateBanner(
    tripId: string,
    userId: string,
    bannerUrl: string
  ): Promise<TripGroup> {
    try {
      // Check if user is owner
      const isOwner = await TripGroupModel.isOwner(tripId, userId);
      if (!isOwner) {
        throw new Error('Only trip owner can update the banner');
      }

      const trip = await TripGroupModel.updateBanner(tripId, bannerUrl);
      
      if (!trip) {
        throw new Error('Trip not found');
      }

      logger.info(`Banner updated for trip: ${tripId} by user ${userId}`);
      return trip;
    } catch (error: any) {
      logger.error('Error updating banner:', error);
      throw error;
    }
  }

  /**
   * Mark trip as completed (for trophy display on globe)
   */
  static async markAsCompleted(
    tripId: string,
    userId: string,
    isCompleted: boolean = true
  ): Promise<TripGroup> {
    try {
      // Check if user is member (any member can mark as completed)
      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        throw new Error('Only trip members can update trip status');
      }

      const trip = await TripGroupModel.markAsCompleted(tripId, isCompleted);
      
      if (!trip) {
        throw new Error('Trip not found');
      }

      logger.info(`Trip ${tripId} marked as ${isCompleted ? 'completed' : 'active'} by user ${userId}`);
      return trip;
    } catch (error: any) {
      logger.error('Error marking trip as completed:', error);
      throw error;
    }
  }
}

