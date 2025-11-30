import { Router } from 'express';
import { SegmentController } from '../controllers/segment.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/trips/:tripId/segments
 * @desc    Create a new segment for a trip
 * @access  Private (trip members)
 */
router.post('/:tripId/segments', SegmentController.createSegment);

/**
 * @route   GET /api/trips/:tripId/segments
 * @desc    Get all segments for a trip
 * @query   withStats=true to include place counts
 * @access  Private (trip members)
 */
router.get('/:tripId/segments', SegmentController.getSegments);

/**
 * @route   GET /api/trips/:tripId/segments/current
 * @desc    Get current segment based on today's date
 * @query   date=YYYY-MM-DD for testing with specific date
 * @access  Private (trip members)
 */
router.get('/:tripId/segments/current', SegmentController.getCurrentSegment);

/**
 * @route   PUT /api/trips/:tripId/segments/reorder
 * @desc    Reorder segments
 * @body    { segmentIds: string[] }
 * @access  Private (trip members)
 */
router.put('/:tripId/segments/reorder', SegmentController.reorderSegments);

/**
 * @route   GET /api/trips/:tripId/segments/:segmentId
 * @desc    Get a specific segment
 * @access  Private (trip members)
 */
router.get('/:tripId/segments/:segmentId', SegmentController.getSegment);

/**
 * @route   PUT /api/trips/:tripId/segments/:segmentId
 * @desc    Update a segment
 * @access  Private (trip members)
 */
router.put('/:tripId/segments/:segmentId', SegmentController.updateSegment);

/**
 * @route   DELETE /api/trips/:tripId/segments/:segmentId
 * @desc    Delete a segment
 * @access  Private (trip members)
 */
router.delete('/:tripId/segments/:segmentId', SegmentController.deleteSegment);

export default router;

