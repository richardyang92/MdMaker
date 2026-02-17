/** Configuration API client. */

import type { ConfigValidateRequest, ConfigValidateResponse } from '../types/ai';
import { API_ENDPOINTS } from './config';

/**
 * Configuration API client
 */
export const configApi = {
  /**
   * Validate AI provider configuration
   */
  async validate(request: ConfigValidateRequest): Promise<ConfigValidateResponse> {
    const response = await fetch(API_ENDPOINTS.configValidate(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to validate config: ${response.status}`);
    }

    return response.json();
  },
};
