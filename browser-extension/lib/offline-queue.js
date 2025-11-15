/**
 * Offline Queue Manager
 * Manages offline flashcard saves and syncs when online
 */

import { StorageManager } from './storage.js';
import { APIClient } from './api-client.js';

const QUEUE_KEY = 'offline_queue';

export class OfflineQueue {
  /**
   * Add item to offline queue
   * @param {Object} item - Flashcard data
   * @returns {Promise<void>}
   */
  static async enqueue(item) {
    try {
      const queue = await StorageManager.get(QUEUE_KEY, []);

      queue.push({
        ...item,
        id: Date.now(),
        timestamp: Date.now()
      });

      await StorageManager.set(QUEUE_KEY, queue);
      console.log('Added to offline queue:', item);
    } catch (error) {
      console.error('OfflineQueue.enqueue error:', error);
      throw error;
    }
  }

  /**
   * Process offline queue
   * @returns {Promise<Object>} Processing results
   */
  static async processQueue() {
    try {
      const queue = await StorageManager.get(QUEUE_KEY, []);

      if (queue.length === 0) {
        return { processed: 0, failed: 0 };
      }

      console.log(`Processing ${queue.length} items from offline queue`);

      const processed = [];
      const failed = [];

      for (const item of queue) {
        try {
          // Remove internal metadata before sending
          const { id, timestamp, ...flashcardData } = item;
          await APIClient.saveFlashcard(flashcardData);
          processed.push(item.id);
          console.log('Successfully processed queue item:', item.id);
        } catch (error) {
          console.error('Failed to process queue item:', error);
          failed.push(item);
        }
      }

      // Keep only failed items in queue
      await StorageManager.set(QUEUE_KEY, failed);

      return {
        processed: processed.length,
        failed: failed.length
      };
    } catch (error) {
      console.error('OfflineQueue.processQueue error:', error);
      throw error;
    }
  }

  /**
   * Get queue size
   * @returns {Promise<number>} Number of items in queue
   */
  static async getQueueSize() {
    try {
      const queue = await StorageManager.get(QUEUE_KEY, []);
      return queue.length;
    } catch (error) {
      console.error('OfflineQueue.getQueueSize error:', error);
      return 0;
    }
  }

  /**
   * Clear entire queue
   * @returns {Promise<void>}
   */
  static async clearQueue() {
    try {
      await StorageManager.set(QUEUE_KEY, []);
    } catch (error) {
      console.error('OfflineQueue.clearQueue error:', error);
      throw error;
    }
  }

  /**
   * Get all queue items
   * @returns {Promise<Array>} Queue items
   */
  static async getQueue() {
    try {
      return await StorageManager.get(QUEUE_KEY, []);
    } catch (error) {
      console.error('OfflineQueue.getQueue error:', error);
      return [];
    }
  }
}
