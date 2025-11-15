/**
 * Authentication Manager
 * Handles user authentication and token management
 */

import { StorageManager } from '../storage/storage.js';

const API_BASE_URL = 'https://firstly-academy.com/api';

export class AuthManager {
  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User object
   */
  static async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Authentication failed');
      }

      const data = await response.json();
      const { token, refreshToken, user } = data;

      // Calculate token expiry (default 1 hour)
      const expiresIn = data.expiresIn || 3600;
      const tokenExpiry = Date.now() + (expiresIn * 1000);

      // Store authentication data
      await StorageManager.setMultiple({
        token,
        refreshToken,
        userId: user.id,
        userEmail: user.email,
        userName: user.name || user.email,
        tokenExpiry
      });

      return user;
    } catch (error) {
      console.error('AuthManager.login error:', error);
      throw error;
    }
  }

  /**
   * Refresh authentication token
   * @returns {Promise<string>} New token
   */
  static async refreshToken() {
    try {
      const refreshToken = await StorageManager.get('refreshToken');

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const { token } = data;

      // Calculate new expiry
      const expiresIn = data.expiresIn || 3600;
      const tokenExpiry = Date.now() + (expiresIn * 1000);

      await StorageManager.setMultiple({
        token,
        tokenExpiry
      });

      return token;
    } catch (error) {
      console.error('AuthManager.refreshToken error:', error);
      // If refresh fails, logout user
      await this.logout();
      throw error;
    }
  }

  /**
   * Get valid authentication token (refresh if needed)
   * @returns {Promise<string>} Valid token
   */
  static async getValidToken() {
    try {
      const { token, tokenExpiry } = await StorageManager.getMultiple(['token', 'tokenExpiry']);

      if (!token) {
        throw new Error('No authentication token');
      }

      // Check if token is expired or about to expire (5 min buffer)
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      if (Date.now() > tokenExpiry - bufferTime) {
        return await this.refreshToken();
      }

      return token;
    } catch (error) {
      console.error('AuthManager.getValidToken error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   * @returns {Promise<void>}
   */
  static async logout() {
    try {
      await StorageManager.removeMultiple([
        'token',
        'refreshToken',
        'userId',
        'userEmail',
        'userName',
        'tokenExpiry'
      ]);
    } catch (error) {
      console.error('AuthManager.logout error:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>} True if authenticated
   */
  static async isAuthenticated() {
    try {
      const token = await StorageManager.get('token');
      return !!token;
    } catch (error) {
      console.error('AuthManager.isAuthenticated error:', error);
      return false;
    }
  }

  /**
   * Get current user data
   * @returns {Promise<Object|null>} User data or null
   */
  static async getCurrentUser() {
    try {
      const { userId, userEmail, userName } = await StorageManager.getMultiple([
        'userId',
        'userEmail',
        'userName'
      ]);

      if (!userId) {
        return null;
      }

      return {
        id: userId,
        email: userEmail,
        name: userName
      };
    } catch (error) {
      console.error('AuthManager.getCurrentUser error:', error);
      return null;
    }
  }
}
