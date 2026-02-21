/**
 * Shared authentication utilities for Buydy server packages
 */

import { formatUserDisplayName, generateRandomAlphanumericString } from "@buydy/iso-auth-utils";

/**
 * Base authentication service class with common functionality
 */
class BaseAuthService {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Create or update user in database (placeholder for database integration)
   * This is a shared implementation that can be overridden by specific providers
   * @param {Object} userInfo - User information from provider
   * @returns {Promise<Object>} User record with JWT token
   */
  async createOrUpdateUser(userInfo) {
    // This is a placeholder implementation
    // In a real application, you would:
    // 1. Check if user exists in your database
    // 2. Create new user or update existing user
    // 3. Generate JWT token
    // 4. Return user data with token

    const mockUser = {
      id: `${this.provider}_${userInfo.id}`,
      email: userInfo.email,
      name: formatUserDisplayName(userInfo, this.provider),
      avatar: userInfo.avatar || null,
      provider: this.provider,
      providerId: userInfo.id,
      emailVerified: userInfo.emailVerified || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add provider-specific fields
    if (userInfo.isPrivateEmail !== undefined) {
      mockUser.isPrivateEmail = userInfo.isPrivateEmail;
    }

    // Mock JWT token generation
    const mockToken = `${this.provider}-jwt-${Date.now()}-${generateRandomAlphanumericString(9)}`;

    return {
      token: mockToken,
      user: mockUser,
    };
  }
}

export { BaseAuthService };
