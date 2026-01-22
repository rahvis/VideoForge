import { Router, type IRouter } from 'express';
import systemRoutes from './system.routes.js';
import authRoutes from './auth.routes.js';
import promptsRoutes from './prompts.routes.js';
import videosRoutes from './videos.routes.js';
import filesRoutes from './files.routes.js';

// ==========================================
// Routes Index
// ==========================================

const router: IRouter = Router();

// Mount routes
router.use('/system', systemRoutes);
router.use('/auth', authRoutes);
router.use('/prompts', promptsRoutes);
router.use('/videos', videosRoutes);
router.use('/files', filesRoutes);

export default router;
