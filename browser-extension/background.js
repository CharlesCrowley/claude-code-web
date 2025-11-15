/**
 * Background Service Worker
 * Handles API communication, authentication, and extension lifecycle
 */

import { APIClient } from './lib/api-client.js';
import { AuthManager } from './lib/auth.js';
import { OfflineQueue } from './lib/offline-queue.js';
import { StorageManager } from './lib/storage.js';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

console.log('Firstly Academy Flashcard Saver - Background service worker initialized');

/**
 * Extension installation/update handler
 */
browserAPI.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First time installation
    console.log('First time installation detected');

    // Open welcome page (optional)
    // browserAPI.tabs.create({ url: 'https://firstly-academy.com/extension-welcome' });

    // Set default preferences
    browserAPI.storage.sync.set({
      preferences: {
        autoDetectLanguage: true,
        includeContext: true,
        highlightColor: '#FFEB3B',
        notificationsEnabled: true,
        syncEnabled: true,
        defaultLanguage: 'en'
      }
    });
  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = browserAPI.runtime.getManifest().version;
    console.log(`Updated from ${previousVersion} to ${currentVersion}`);
  }

  // Create context menu
  createContextMenu();
});

/**
 * Create context menu items
 */
function createContextMenu() {
  // Remove existing menus first
  browserAPI.contextMenus.removeAll(() => {
    // Create "Save to Flashcards" menu
    browserAPI.contextMenus.create({
      id: 'save-to-flashcards',
      title: 'Save "%s" to Flashcards',
      contexts: ['selection']
    });

    console.log('Context menu created');
  });
}

/**
 * Context menu click handler
 */
browserAPI.contextMenus.onClicked.addListener((info, tab) => {
  console.log('Context menu clicked:', info.menuItemId);

  if (info.menuItemId === 'save-to-flashcards') {
    // Send message to content script to save selection
    browserAPI.tabs.sendMessage(tab.id, {
      type: 'SAVE_SELECTION',
      text: info.selectionText
    }).catch(error => {
      console.error('Failed to send message to content script:', error);
    });
  }
});

/**
 * Message handler from content scripts and popup
 */
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type);

  // Handle different message types
  switch (message.type) {
    case 'SAVE_FLASHCARD':
      handleSaveFlashcard(message.data)
        .then(result => sendResponse({ success: true, result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response

    case 'GET_STATS':
      handleGetStats()
        .then(stats => sendResponse({ success: true, stats }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'CHECK_AUTH':
      handleCheckAuth()
        .then(isAuthenticated => sendResponse({ success: true, isAuthenticated }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'PROCESS_OFFLINE_QUEUE':
      handleProcessOfflineQueue()
        .then(result => sendResponse({ success: true, result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

/**
 * Handle save flashcard request
 * @param {Object} data - Flashcard data
 * @returns {Promise<Object>} Save result
 */
async function handleSaveFlashcard(data) {
  try {
    console.log('Saving flashcard:', data);

    // Check if user is authenticated
    const isAuthenticated = await AuthManager.isAuthenticated();

    if (!isAuthenticated) {
      throw new Error('Please sign in to save flashcards');
    }

    // Check if online
    if (!navigator.onLine) {
      console.log('Offline - adding to queue');
      await OfflineQueue.enqueue(data);
      return { message: 'Saved to offline queue', offline: true };
    }

    // Try to save to API
    try {
      const result = await APIClient.saveFlashcard(data);
      console.log('Flashcard saved successfully:', result);

      // Update stats cache
      await updateStatsCache();

      return result;
    } catch (apiError) {
      console.error('API error, adding to offline queue:', apiError);
      await OfflineQueue.enqueue(data);
      return { message: 'Saved to offline queue', offline: true };
    }
  } catch (error) {
    console.error('Failed to save flashcard:', error);
    throw error;
  }
}

/**
 * Handle get stats request
 * @returns {Promise<Object>} Stats data
 */
async function handleGetStats() {
  try {
    // Check cache first
    const cache = await StorageManager.get('todayStats');
    const now = Date.now();

    // Cache valid for 5 minutes
    if (cache && cache.lastUpdated && (now - cache.lastUpdated) < 5 * 60 * 1000) {
      console.log('Returning cached stats');
      return cache;
    }

    // Fetch fresh stats
    const stats = await APIClient.getTodayStats();
    await StorageManager.set('todayStats', {
      ...stats,
      lastUpdated: now
    });

    return stats;
  } catch (error) {
    console.error('Failed to get stats:', error);
    // Return cached stats even if expired
    const cache = await StorageManager.get('todayStats');
    if (cache) {
      return cache;
    }
    throw error;
  }
}

/**
 * Update stats cache
 */
async function updateStatsCache() {
  try {
    const stats = await APIClient.getTodayStats();
    await StorageManager.set('todayStats', {
      ...stats,
      lastUpdated: Date.now()
    });
  } catch (error) {
    console.error('Failed to update stats cache:', error);
  }
}

/**
 * Handle check authentication request
 * @returns {Promise<boolean>} Authentication status
 */
async function handleCheckAuth() {
  return await AuthManager.isAuthenticated();
}

/**
 * Handle process offline queue request
 * @returns {Promise<Object>} Processing result
 */
async function handleProcessOfflineQueue() {
  try {
    console.log('Processing offline queue');
    const result = await OfflineQueue.processQueue();
    console.log('Queue processing result:', result);

    // Update stats after processing queue
    if (result.processed > 0) {
      await updateStatsCache();
    }

    return result;
  } catch (error) {
    console.error('Failed to process offline queue:', error);
    throw error;
  }
}

/**
 * Listen for online/offline events
 */
self.addEventListener('online', async () => {
  console.log('Browser is online - processing offline queue');

  try {
    const queueSize = await OfflineQueue.getQueueSize();

    if (queueSize > 0) {
      const result = await OfflineQueue.processQueue();
      console.log(`Synced ${result.processed} flashcards, ${result.failed} failed`);

      // Show notification if notifications are enabled
      const prefs = await browserAPI.storage.sync.get('preferences');
      if (prefs.preferences?.notificationsEnabled !== false) {
        browserAPI.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'Flashcards Synced',
          message: `Successfully synced ${result.processed} flashcard${result.processed !== 1 ? 's' : ''}`
        });
      }
    }
  } catch (error) {
    console.error('Failed to process offline queue:', error);
  }
});

self.addEventListener('offline', () => {
  console.log('Browser is offline');
});

/**
 * Alarm handler for periodic tasks
 */
browserAPI.alarms.onAlarm.addListener((alarm) => {
  console.log('Alarm triggered:', alarm.name);

  if (alarm.name === 'sync-queue') {
    handleProcessOfflineQueue().catch(console.error);
  }
});

/**
 * Create periodic sync alarm (every 30 minutes)
 */
browserAPI.alarms.create('sync-queue', {
  delayInMinutes: 30,
  periodInMinutes: 30
});

/**
 * Handle service worker activation
 */
self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  event.waitUntil(self.clients.claim());
});

/**
 * Keep service worker alive for important tasks
 */
let keepAliveInterval = null;

function startKeepAlive() {
  if (!keepAliveInterval) {
    keepAliveInterval = setInterval(() => {
      // Ping to keep alive
      console.log('Keep-alive ping');
    }, 20000); // Every 20 seconds
  }
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Start keep-alive when extension is active
startKeepAlive();

console.log('Background service worker setup complete');
