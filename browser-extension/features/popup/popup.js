/**
 * Popup Script
 * Handles popup UI logic, authentication, and settings
 */

import { AuthManager } from '../auth/auth.js';
import { Preferences } from '../preferences/preferences.js';
import { StorageManager } from '../storage/storage.js';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// DOM elements
const authSection = document.getElementById('auth-section');
const mainSection = document.getElementById('main-section');
const loadingSection = document.getElementById('loading-section');

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const loginBtnText = document.getElementById('login-btn-text');
const loginBtnSpinner = document.getElementById('login-btn-spinner');
const errorMessage = document.getElementById('error-message');

const logoutBtn = document.getElementById('logout-btn');
const userEmailEl = document.getElementById('user-email');
const statsCountEl = document.getElementById('stats-count');
const refreshStatsBtn = document.getElementById('refresh-stats-btn');

const includeContextCheckbox = document.getElementById('include-context');
const autoDetectCheckbox = document.getElementById('auto-detect');
const notificationsCheckbox = document.getElementById('notifications-enabled');
const colorRadios = document.querySelectorAll('input[name="color"]');

const openDashboardBtn = document.getElementById('open-dashboard');
const syncNowBtn = document.getElementById('sync-now-btn');
const offlineQueueInfo = document.getElementById('offline-queue-info');
const queueCountEl = document.getElementById('queue-count');

/**
 * Initialize popup
 */
async function init() {
  console.log('Popup initializing...');

  try {
    // Show loading
    showSection(loadingSection);

    // Check authentication status
    const isAuthenticated = await AuthManager.isAuthenticated();

    if (isAuthenticated) {
      await showMainInterface();
    } else {
      showAuthInterface();
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showAuthInterface();
  }
}

/**
 * Show authentication interface
 */
function showAuthInterface() {
  showSection(authSection);
}

/**
 * Show main interface
 */
async function showMainInterface() {
  try {
    // Load user data
    const user = await AuthManager.getCurrentUser();

    if (user) {
      userEmailEl.textContent = user.email;
    }

    // Load preferences
    await loadPreferences();

    // Load stats
    await loadStats();

    // Check offline queue
    await checkOfflineQueue();

    // Show main section
    showSection(mainSection);
  } catch (error) {
    console.error('Error showing main interface:', error);
    showAuthInterface();
  }
}

/**
 * Show specific section
 * @param {HTMLElement} section - Section to show
 */
function showSection(section) {
  authSection.style.display = 'none';
  mainSection.style.display = 'none';
  loadingSection.style.display = 'none';

  section.style.display = 'block';
}

/**
 * Handle login form submission
 */
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  try {
    // Show loading state
    setLoginLoading(true);
    errorMessage.textContent = '';

    // Attempt login
    const user = await AuthManager.login(email, password);

    console.log('Login successful:', user);

    // Show main interface
    await showMainInterface();
  } catch (error) {
    console.error('Login error:', error);
    showError(error.message || 'Login failed. Please try again.');
  } finally {
    setLoginLoading(false);
  }
});

/**
 * Set login button loading state
 * @param {boolean} loading - Loading state
 */
function setLoginLoading(loading) {
  loginBtn.disabled = loading;
  loginBtnText.style.display = loading ? 'none' : 'inline';
  loginBtnSpinner.style.display = loading ? 'inline-block' : 'none';
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
  errorMessage.textContent = message;
}

/**
 * Handle logout
 */
logoutBtn.addEventListener('click', async () => {
  try {
    await AuthManager.logout();
    console.log('Logged out successfully');

    // Clear form
    emailInput.value = '';
    passwordInput.value = '';
    errorMessage.textContent = '';

    // Show auth interface
    showAuthInterface();
  } catch (error) {
    console.error('Logout error:', error);
  }
});

/**
 * Load user preferences
 */
async function loadPreferences() {
  try {
    const prefs = await Preferences.get();

    includeContextCheckbox.checked = prefs.includeContext !== false;
    autoDetectCheckbox.checked = prefs.autoDetectLanguage !== false;
    notificationsCheckbox.checked = prefs.notificationsEnabled !== false;

    // Set selected color
    const highlightColor = prefs.highlightColor || '#FFEB3B';
    colorRadios.forEach(radio => {
      if (radio.value === highlightColor) {
        radio.checked = true;
      }
    });
  } catch (error) {
    console.error('Error loading preferences:', error);
  }
}

/**
 * Save preference
 * @param {string} key - Preference key
 * @param {*} value - Preference value
 */
async function savePreference(key, value) {
  try {
    await Preferences.set({ [key]: value });
    console.log('Preference saved:', key, value);
  } catch (error) {
    console.error('Error saving preference:', error);
  }
}

/**
 * Preference change handlers
 */
includeContextCheckbox.addEventListener('change', (e) => {
  savePreference('includeContext', e.target.checked);
});

autoDetectCheckbox.addEventListener('change', (e) => {
  savePreference('autoDetectLanguage', e.target.checked);
});

notificationsCheckbox.addEventListener('change', (e) => {
  savePreference('notificationsEnabled', e.target.checked);
});

colorRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.checked) {
      savePreference('highlightColor', e.target.value);
    }
  });
});

/**
 * Load statistics
 */
async function loadStats() {
  try {
    const response = await browserAPI.runtime.sendMessage({
      type: 'GET_STATS'
    });

    if (response && response.success) {
      const count = response.stats.count || 0;
      updateStatsDisplay(count);
    } else {
      updateStatsDisplay('-');
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    updateStatsDisplay('-');
  }
}

/**
 * Update stats display
 * @param {number|string} count - Flashcard count
 */
function updateStatsDisplay(count) {
  const countNumberEl = statsCountEl.querySelector('.count-number');
  const countLabelEl = statsCountEl.querySelector('.count-label');

  if (countNumberEl) {
    countNumberEl.textContent = count;
  }

  if (countLabelEl && typeof count === 'number') {
    countLabelEl.textContent = count === 1 ? 'saved' : 'saved';
  }
}

/**
 * Refresh stats
 */
refreshStatsBtn.addEventListener('click', async () => {
  await loadStats();
});

/**
 * Check offline queue
 */
async function checkOfflineQueue() {
  try {
    const queueSize = await browserAPI.runtime.sendMessage({
      type: 'GET_QUEUE_SIZE'
    });

    if (queueSize && queueSize > 0) {
      queueCountEl.textContent = queueSize;
      offlineQueueInfo.style.display = 'flex';
      syncNowBtn.style.display = 'flex';
    } else {
      offlineQueueInfo.style.display = 'none';
      syncNowBtn.style.display = 'none';
    }
  } catch (error) {
    console.error('Error checking offline queue:', error);
  }
}

/**
 * Sync offline queue
 */
syncNowBtn.addEventListener('click', async () => {
  try {
    syncNowBtn.disabled = true;
    syncNowBtn.textContent = 'Syncing...';

    const response = await browserAPI.runtime.sendMessage({
      type: 'PROCESS_OFFLINE_QUEUE'
    });

    if (response && response.success) {
      console.log('Queue processed:', response.result);

      // Refresh stats and queue info
      await loadStats();
      await checkOfflineQueue();
    }
  } catch (error) {
    console.error('Error syncing queue:', error);
  } finally {
    syncNowBtn.disabled = false;
    syncNowBtn.innerHTML = '<span>Sync Now</span><span class="sync-icon">⟳</span>';
  }
});

/**
 * Open dashboard
 */
openDashboardBtn.addEventListener('click', () => {
  browserAPI.tabs.create({
    url: 'https://firstly-academy.com/dashboard'
  });
});

/**
 * Listen for storage changes
 */
browserAPI.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    // Refresh stats if they changed
    if (changes.todayStats) {
      loadStats();
    }

    // Refresh queue info if it changed
    if (changes.offline_queue) {
      checkOfflineQueue();
    }
  }
});

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('Popup script loaded');
