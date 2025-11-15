/**
 * Preferences Manager
 * Manages user preferences using sync storage
 */

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

export class Preferences {
  static defaults = {
    autoDetectLanguage: true,
    includeContext: true,
    highlightColor: '#FFEB3B',
    notificationsEnabled: true,
    syncEnabled: true,
    defaultLanguage: 'en'
  };

  /**
   * Get user preferences
   * @returns {Promise<Object>} User preferences with defaults
   */
  static async get() {
    try {
      const result = await browserAPI.storage.sync.get('preferences');
      return { ...this.defaults, ...result.preferences };
    } catch (error) {
      console.error('Preferences.get error:', error);
      return this.defaults;
    }
  }

  /**
   * Update preferences
   * @param {Object} updates - Preferences to update
   * @returns {Promise<Object>} Updated preferences
   */
  static async set(updates) {
    try {
      const current = await this.get();
      const updated = { ...current, ...updates };
      await browserAPI.storage.sync.set({ preferences: updated });
      return updated;
    } catch (error) {
      console.error('Preferences.set error:', error);
      throw error;
    }
  }

  /**
   * Reset to defaults
   * @returns {Promise<Object>} Default preferences
   */
  static async reset() {
    try {
      await browserAPI.storage.sync.set({ preferences: this.defaults });
      return this.defaults;
    } catch (error) {
      console.error('Preferences.reset error:', error);
      throw error;
    }
  }

  /**
   * Get specific preference
   * @param {string} key - Preference key
   * @returns {Promise<*>} Preference value
   */
  static async getValue(key) {
    const prefs = await this.get();
    return prefs[key];
  }

  /**
   * Set specific preference
   * @param {string} key - Preference key
   * @param {*} value - Preference value
   * @returns {Promise<void>}
   */
  static async setValue(key, value) {
    await this.set({ [key]: value });
  }
}
