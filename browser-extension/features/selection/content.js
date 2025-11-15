/**
 * Content Script
 * Runs on all web pages to capture text selection and save flashcards
 */

import { SelectionHandler } from './selection.js';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Initialize
let selectionHandler = new SelectionHandler();
let selectedText = '';
let contextMenu = null;

// Restore highlights on page load
document.addEventListener('DOMContentLoaded', () => {
  SelectionHandler.restoreHighlights();
});

// Capture text selection
document.addEventListener('mouseup', handleTextSelection);
document.addEventListener('touchend', handleTextSelection);

// Hide menu when clicking elsewhere
document.addEventListener('mousedown', (event) => {
  if (contextMenu && !contextMenu.contains(event.target)) {
    hideContextMenu();
  }
});

// Hide menu on scroll
document.addEventListener('scroll', () => {
  if (contextMenu) {
    hideContextMenu();
  }
});

/**
 * Handle text selection event
 * @param {Event} event - Mouse/touch event
 */
function handleTextSelection(event) {
  // Small delay to ensure selection is complete
  setTimeout(() => {
    const selection = selectionHandler.getSelection();

    if (selection && selection.text.length > 0) {
      selectedText = selection.text;

      // Only show menu for reasonable text lengths (1-200 characters)
      if (selectedText.length >= 1 && selectedText.length <= 200) {
        showContextMenu(event, selection);
      }
    } else {
      hideContextMenu();
    }
  }, 50);
}

/**
 * Show context menu near selection
 * @param {Event} event - Mouse/touch event
 * @param {Object} selection - Selection data
 */
function showContextMenu(event, selection) {
  // Remove existing menu
  hideContextMenu();

  // Create menu element
  contextMenu = document.createElement('div');
  contextMenu.id = 'flashcard-context-menu';
  contextMenu.className = 'flashcard-menu';

  // Menu content
  contextMenu.innerHTML = `
    <button id="save-flashcard-btn" class="flashcard-menu-btn">
      <span class="icon">💾</span>
      <span class="text">Save to Flashcards</span>
    </button>
  `;

  // Position menu near selection
  const x = event.pageX || selection.position.x;
  const y = (event.pageY || selection.position.y) + 10;

  contextMenu.style.position = 'absolute';
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.style.zIndex = '999999';

  document.body.appendChild(contextMenu);

  // Add click handler
  const saveBtn = document.getElementById('save-flashcard-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveToFlashcards(selection);
    });
  }

  // Adjust position if menu goes off screen
  adjustMenuPosition();
}

/**
 * Adjust menu position to stay on screen
 */
function adjustMenuPosition() {
  if (!contextMenu) return;

  const rect = contextMenu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Adjust horizontal position
  if (rect.right > viewportWidth) {
    const newLeft = parseFloat(contextMenu.style.left) - (rect.right - viewportWidth) - 10;
    contextMenu.style.left = `${Math.max(10, newLeft)}px`;
  }

  // Adjust vertical position
  if (rect.bottom > viewportHeight) {
    const newTop = parseFloat(contextMenu.style.top) - rect.height - 30;
    contextMenu.style.top = `${Math.max(10, newTop)}px`;
  }
}

/**
 * Hide context menu
 */
function hideContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

/**
 * Save selection to flashcards
 * @param {Object} selection - Selection data
 */
async function saveToFlashcards(selection) {
  try {
    // Show loading state
    showNotification('Saving...', 'info');

    // Get user preferences
    const prefs = await browserAPI.storage.sync.get('preferences');
    const preferences = prefs.preferences || {};

    // Prepare flashcard data
    const flashcardData = {
      word: selection.text,
      context: preferences.includeContext !== false ? selection.context : null,
      sourceUrl: selection.metadata.url,
      sourceTitle: selection.metadata.title,
      language: preferences.autoDetectLanguage ? selection.metadata.language : preferences.defaultLanguage,
      timestamp: selection.metadata.timestamp
    };

    // Send message to background script
    const response = await browserAPI.runtime.sendMessage({
      type: 'SAVE_FLASHCARD',
      data: flashcardData
    });

    if (response && response.success) {
      // Highlight the saved text
      if (preferences.highlightColor) {
        selectionHandler.highlightSelection(preferences.highlightColor, true);
      }

      showNotification('✓ Saved to flashcards!', 'success');

      // Clear selection
      window.getSelection().removeAllRanges();
    } else {
      const errorMsg = response?.error || 'Failed to save';
      showNotification(`✗ ${errorMsg}`, 'error');
    }
  } catch (error) {
    console.error('Failed to save flashcard:', error);
    showNotification('✗ Failed to save. Please try again.', 'error');
  } finally {
    hideContextMenu();
  }
}

/**
 * Show notification toast
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, info)
 */
function showNotification(message, type = 'success') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.flashcard-notification');
  existingNotifications.forEach(n => n.remove());

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `flashcard-notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Listen for messages from background script
 */
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_SELECTION') {
    // Handle context menu save
    const selection = selectionHandler.getSelection();
    if (selection) {
      saveToFlashcards(selection);
    }
  }

  return false;
});

// Log initialization
console.log('Firstly Academy Flashcard Saver - Content script loaded');
