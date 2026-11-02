import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isInternalGenerationCall } from '../_lib/auth.js';
import { requiredEnv, sendRouteError } from '../_lib/respond.js';
import { getListedImageModels } from '../../src/lib/ai/client.js';

/**
 * Diagnostic: image-capable model ids this OPENAI_API_KEY can see.
 * GET /api/admin/ai-models
 * Header: x-generation-internal-secret = GENERATION_INTERNAL_SECRET
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requiredEnv('OPENAI_API_KEY');
  } catch (error) {
    return sendRouteError(res, error);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isInternalGenerationCall(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const models = await getListedImageModels();
    return res.status(200).json({ models: models.map((model) => model.id) });
  } catch (error) {
    return sendRouteError(res, error);
  }
}
