import { query } from '../config/database';
import { DailyPlan, DailyPlanStop, SavedItem } from '../types';
import { SavedItemModel } from './savedItem.model';
import logger from '../config/logger';

export class DailyPlanModel {
  /**
   * Create a new daily plan
   */
  static async create(
    tripGroupId: string,
    planDate: Date,
    createdBy: string,
    options?: {
      segmentId?: string;
      title?: string;
      stops?: DailyPlanStop[];
      routeData?: any;
      totalDurationMinutes?: number;
      totalDistanceMeters?: number;
    }
  ): Promise<DailyPlan> {
    const result = await query(
      `INSERT INTO daily_plans 
       (trip_group_id, segment_id, plan_date, title, stops, route_data, 
        total_duration_minutes, total_distance_meters, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (trip_group_id, plan_date) 
       DO UPDATE SET 
         segment_id = EXCLUDED.segment_id,
         title = EXCLUDED.title,
         stops = EXCLUDED.stops,
         route_data = EXCLUDED.route_data,
         total_duration_minutes = EXCLUDED.total_duration_minutes,
         total_distance_meters = EXCLUDED.total_distance_meters,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        tripGroupId,
        options?.segmentId,
        planDate,
        options?.title,
        JSON.stringify(options?.stops || []),
        options?.routeData ? JSON.stringify(options.routeData) : null,
        options?.totalDurationMinutes,
        options?.totalDistanceMeters,
        createdBy,
      ]
    );

    logger.info(`Created/updated daily plan for ${planDate.toISOString().split('T')[0]}`);
    return this.parsePlan(result.rows[0]);
  }

  /**
   * Find plan by ID
   */
  static async findById(id: string): Promise<DailyPlan | null> {
    const result = await query('SELECT * FROM daily_plans WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    return this.parsePlan(result.rows[0]);
  }

  /**
   * Find plan by trip and date
   */
  static async findByDate(tripGroupId: string, planDate: Date): Promise<DailyPlan | null> {
    const dateStr = planDate.toISOString().split('T')[0];
    const result = await query(
      `SELECT * FROM daily_plans 
       WHERE trip_group_id = $1 AND plan_date = $2`,
      [tripGroupId, dateStr]
    );
    if (!result.rows[0]) return null;
    return this.parsePlan(result.rows[0]);
  }

  /**
   * Get today's plan for a trip
   */
  static async getTodaysPlan(tripGroupId: string): Promise<DailyPlan | null> {
    return this.findByDate(tripGroupId, new Date());
  }

  /**
   * Get all plans for a trip
   */
  static async findByTrip(tripGroupId: string): Promise<DailyPlan[]> {
    const result = await query(
      `SELECT * FROM daily_plans 
       WHERE trip_group_id = $1 
       ORDER BY plan_date ASC`,
      [tripGroupId]
    );
    return result.rows.map(this.parsePlan);
  }

  /**
   * Get plans for a segment
   */
  static async findBySegment(segmentId: string): Promise<DailyPlan[]> {
    const result = await query(
      `SELECT * FROM daily_plans 
       WHERE segment_id = $1 
       ORDER BY plan_date ASC`,
      [segmentId]
    );
    return result.rows.map(this.parsePlan);
  }

  /**
   * Update plan stops
   */
  static async updateStops(
    id: string,
    stops: DailyPlanStop[],
    routeData?: any,
    totalDurationMinutes?: number,
    totalDistanceMeters?: number
  ): Promise<DailyPlan | null> {
    const result = await query(
      `UPDATE daily_plans 
       SET stops = $1, route_data = $2, total_duration_minutes = $3, 
           total_distance_meters = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        JSON.stringify(stops),
        routeData ? JSON.stringify(routeData) : null,
        totalDurationMinutes,
        totalDistanceMeters,
        id,
      ]
    );
    if (!result.rows[0]) return null;
    return this.parsePlan(result.rows[0]);
  }

  /**
   * Update plan status
   */
  static async updateStatus(
    id: string,
    status: 'active' | 'completed' | 'cancelled'
  ): Promise<DailyPlan | null> {
    const result = await query(
      `UPDATE daily_plans SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (!result.rows[0]) return null;
    return this.parsePlan(result.rows[0]);
  }

  /**
   * Add a stop to existing plan
   */
  static async addStop(
    id: string,
    savedItemId: string,
    plannedTime?: string,
    durationMinutes?: number
  ): Promise<DailyPlan | null> {
    const plan = await this.findById(id);
    if (!plan) return null;

    const newStop: DailyPlanStop = {
      saved_item_id: savedItemId,
      order: plan.stops.length,
      planned_time: plannedTime,
      duration_minutes: durationMinutes,
    };

    const stops = [...plan.stops, newStop];
    return this.updateStops(id, stops);
  }

  /**
   * Remove a stop from plan
   */
  static async removeStop(id: string, savedItemId: string): Promise<DailyPlan | null> {
    const plan = await this.findById(id);
    if (!plan) return null;

    const stops = plan.stops
      .filter(s => s.saved_item_id !== savedItemId)
      .map((s, i) => ({ ...s, order: i }));

    return this.updateStops(id, stops);
  }

  /**
   * Reorder stops in plan
   */
  static async reorderStops(id: string, savedItemIds: string[]): Promise<DailyPlan | null> {
    const plan = await this.findById(id);
    if (!plan) return null;

    // Create a map of existing stops
    const stopMap = new Map(plan.stops.map(s => [s.saved_item_id, s]));

    // Reorder based on new order
    const reorderedStops: DailyPlanStop[] = savedItemIds.map((itemId, index) => {
      const existing = stopMap.get(itemId);
      return {
        saved_item_id: itemId,
        order: index,
        planned_time: existing?.planned_time,
        duration_minutes: existing?.duration_minutes,
        notes: existing?.notes,
      };
    });

    return this.updateStops(id, reorderedStops);
  }

  /**
   * Swap a stop with another place
   */
  static async swapStop(
    id: string,
    oldSavedItemId: string,
    newSavedItemId: string
  ): Promise<DailyPlan | null> {
    const plan = await this.findById(id);
    if (!plan) return null;

    const stops = plan.stops.map(s => {
      if (s.saved_item_id === oldSavedItemId) {
        return { ...s, saved_item_id: newSavedItemId };
      }
      return s;
    });

    return this.updateStops(id, stops);
  }

  /**
   * Delete plan
   */
  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM daily_plans WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get plan with populated place details
   */
  static async getPopulatedPlan(id: string): Promise<(DailyPlan & { populatedStops: Array<DailyPlanStop & { place: SavedItem }> }) | null> {
    const plan = await this.findById(id);
    if (!plan) return null;

    const populatedStops = await Promise.all(
      plan.stops.map(async (stop) => {
        // Handle guide-imported plans where saved_item_id might not exist
        if (!stop.saved_item_id) {
          // Create a placeholder place from the stop's place_name or notes
          const placeholderPlace: SavedItem = {
            id: `placeholder-${stop.order}`,
            trip_group_id: plan.trip_group_id,
            added_by: plan.created_by || '',
            name: stop.place_name || stop.notes || `Stop ${stop.order + 1}`,
            category: 'place' as any,
            description: stop.notes || '',
            status: 'saved' as any,
            created_at: new Date(),
            updated_at: new Date(),
          };
          return { ...stop, place: placeholderPlace };
        }
        const place = await SavedItemModel.findById(stop.saved_item_id);
        return { ...stop, place: place! };
      })
    );

    return { ...plan, populatedStops: populatedStops.filter(s => s.place) };
  }

  /**
   * Get today's plan with populated places
   */
  static async getTodaysPopulatedPlan(tripGroupId: string): Promise<(DailyPlan & { populatedStops: Array<DailyPlanStop & { place: SavedItem }> }) | null> {
    const plan = await this.getTodaysPlan(tripGroupId);
    if (!plan) return null;
    return this.getPopulatedPlan(plan.id);
  }

  /**
   * Parse database row to DailyPlan
   */
  private static parsePlan(row: any): DailyPlan {
    return {
      id: row.id,
      trip_group_id: row.trip_group_id,
      segment_id: row.segment_id,
      plan_date: new Date(row.plan_date),
      title: row.title,
      stops: typeof row.stops === 'string' ? JSON.parse(row.stops) : row.stops || [],
      route_data: typeof row.route_data === 'string' ? JSON.parse(row.route_data) : row.route_data,
      total_duration_minutes: row.total_duration_minutes,
      total_distance_meters: row.total_distance_meters,
      status: row.status,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by,
    };
  }
}

