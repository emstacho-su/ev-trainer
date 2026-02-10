import { Router } from 'express';
import {
  initiateGoogle,
  googleCallback,
  initiateGitHub,
  githubCallback,
} from './oauth.controller';

const router = Router();

// Google OAuth
router.get('/google', initiateGoogle);
router.get('/google/callback', googleCallback);

// GitHub OAuth
router.get('/github', initiateGitHub);
router.get('/github/callback', githubCallback);

export default router;
