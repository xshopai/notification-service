/**
 * Operational Routes
 * Routes for health checks, readiness, liveness, and metrics endpoints
 */

import express from 'express';
import { readiness, liveness, metrics } from '../controllers/operational.controller.js';

const router = express.Router();

// Health check endpoints
router.get('/health/ready', readiness);
router.get('/health/live', liveness);
router.get('/metrics', metrics);

export default router;
