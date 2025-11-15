/**
 * API Client
 * Handles all API communication with Firstly Academy backend
 */

import { AuthManager } from './auth.js';

const API_BASE_URL = 'https://firstly-academy.com/api';

export class APIClient {
  /**
   * Make authenticated API request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  static async request(endpoint, options = {}) {
    try {
      const token = await AuthManager.getValidToken();

      const defaultHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const config = {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

      // Handle authentication errors
      if (response.status === 401) {
        await AuthManager.logout();
        throw new Error('Authentication required');
      }

      // Handle other errors
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }

      // Parse and return JSON response
      return await response.json();
    } catch (error) {
      console.error('APIClient.request error:', error);
      throw error;
    }
  }

  /**
   * Save a flashcard
   * @param {Object} data - Flashcard data
   * @returns {Promise<Object>} Created flashcard
   */
  static async saveFlashcard(data) {
    return this.request('/flashcards', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Get user flashcards
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Flashcards list
   */
  static async getFlashcards(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/flashcards?${query}` : '/flashcards';
    return this.request(endpoint);
  }

  /**
   * Update a flashcard
   * @param {string} id - Flashcard ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated flashcard
   */
  static async updateFlashcard(id, data) {
    return this.request(`/flashcards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  /**
   * Delete a flashcard
   * @param {string} id - Flashcard ID
   * @returns {Promise<void>}
   */
  static async deleteFlashcard(id) {
    return this.request(`/flashcards/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get today's flashcard statistics
   * @returns {Promise<Object>} Today's stats
   */
  static async getTodayStats() {
    return this.request('/flashcards/stats/today');
  }

  /**
   * Batch save flashcards
   * @param {Array} flashcards - Array of flashcard data
   * @returns {Promise<Object>} Batch save results
   */
  static async batchSaveFlashcards(flashcards) {
    return this.request('/flashcards/batch', {
      method: 'POST',
      body: JSON.stringify({ flashcards })
    });
  }
}
