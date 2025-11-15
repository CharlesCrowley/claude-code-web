/**
 * Storage Manager
 * Abstraction layer over browser.storage API
 */

// Use chrome namespace (compatible with all browsers via webextension-polyfill)
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

export class StorageManager {
  /**
   * Get item with optional default value
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {Promise<*>} Stored value or default
   */
  static async get(key, defaultValue = null) {
    try {
      const result = await browserAPI.storage.local.get(key);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
      console.error('StorageManager.get error:', error);
      return defaultValue;
    }
  }

  /**
   * Get multiple items
   * @param {string[]} keys - Array of keys
   * @returns {Promise<Object>} Object with key-value pairs
   */
  static async getMultiple(keys) {
    try {
      return await browserAPI.storage.local.get(keys);
    } catch (error) {
      console.error('StorageManager.getMultiple error:', error);
      return {};
    }
  }

  /**
   * Set item
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {Promise<void>}
   */
  static async set(key, value) {
    try {
      await browserAPI.storage.local.set({ [key]: value });
    } catch (error) {
      console.error('StorageManager.set error:', error);
      throw error;
    }
  }

  /**
   * Set multiple items
   * @param {Object} items - Object with key-value pairs
   * @returns {Promise<void>}
   */
  static async setMultiple(items) {
    try {
      await browserAPI.storage.local.set(items);
    } catch (error) {
      console.error('StorageManager.setMultiple error:', error);
      throw error;
    }
  }

  /**
   * Remove item
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  static async remove(key) {
    try {
      await browserAPI.storage.local.remove(key);
    } catch (error) {
      console.error('StorageManager.remove error:', error);
      throw error;
    }
  }

  /**
   * Remove multiple items
   * @param {string[]} keys - Array of keys
   * @returns {Promise<void>}
   */
  static async removeMultiple(keys) {
    try {
      await browserAPI.storage.local.remove(keys);
    } catch (error) {
      console.error('StorageManager.removeMultiple error:', error);
      throw error;
    }
  }

  /**
   * Clear all storage
   * @returns {Promise<void>}
   */
  static async clear() {
    try {
      await browserAPI.storage.local.clear();
    } catch (error) {
      console.error('StorageManager.clear error:', error);
      throw error;
    }
  }

  /**
   * Get storage usage
   * @returns {Promise<Object>} Usage statistics
   */
  static async getUsage() {
    try {
      const bytes = await browserAPI.storage.local.getBytesInUse();
      return {
        bytes,
        kb: (bytes / 1024).toFixed(2),
        mb: (bytes / 1024 / 1024).toFixed(2)
      };
    } catch (error) {
      console.error('StorageManager.getUsage error:', error);
      return { bytes: 0, kb: '0', mb: '0' };
    }
  }

  /**
   * Listen for storage changes
   * @param {Function} callback - Callback function
   * @returns {void}
   */
  static onChange(callback) {
    browserAPI.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        callback(changes);
      }
    });
  }
}
