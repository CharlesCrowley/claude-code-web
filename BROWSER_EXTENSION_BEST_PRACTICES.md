# Browser Extension Best Practices Guide
## Comprehensive Guide for Chrome, Brave, and Firefox Extensions (2025)

---

## Table of Contents
1. [Introduction & Overview](#introduction--overview)
2. [Manifest V3 Architecture](#manifest-v3-architecture)
3. [Cross-Browser Compatibility](#cross-browser-compatibility)
4. [Extension Components](#extension-components)
5. [Authentication & Security](#authentication--security)
6. [Text Selection & Highlighting](#text-selection--highlighting)
7. [Server Communication](#server-communication)
8. [Storage Patterns](#storage-patterns)
9. [Performance Optimization](#performance-optimization)
10. [Testing & Debugging](#testing--debugging)
11. [Publishing & Distribution](#publishing--distribution)
12. [Common Pitfalls & Solutions](#common-pitfalls--solutions)

---

## Introduction & Overview

### What is a Browser Extension?
Browser extensions are small software programs that customize and enhance the browsing experience. They enable users to tailor browser functionality to individual needs and preferences.

### Target Browsers
- **Chrome**: Market leader, uses Chromium engine
- **Brave**: Privacy-focused, Chromium-based (Chrome extension compatible)
- **Firefox**: Standards-compliant, independent engine
- **Edge**: Chromium-based (Chrome extension compatible)

### Current Standards (2025)
- **Manifest V3** is the current standard across all major browsers
- Manifest V2 support ended in Chrome in January 2025
- Firefox and Safari have adopted Manifest V3 with high compatibility

---

## Manifest V3 Architecture

### Key Changes from V2
1. **Service Workers** replace background pages/scripts
2. **Declarative APIs** for network request modification
3. **Promises** for asynchronous operations
4. **Enhanced security** with restricted remote code execution
5. **Better resource management** (extensions run only when needed)

### Basic Manifest Structure

```json
{
  "manifest_version": 3,
  "name": "Extension Name",
  "version": "1.0.0",
  "description": "Extension description",
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://*.example.com/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"]
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png"
    }
  }
}
```

### Firefox-Specific Manifest Keys

```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "extension@example.com",
      "strict_min_version": "109.0"
    }
  }
}
```

---

## Cross-Browser Compatibility

### Best Practices for Cross-Browser Development

#### 1. Start with Firefox
**Rationale**: Firefox is the most compliant with proposed WebExtension standards and provides better developer feedback.

#### 2. Use the `browser` Namespace with Polyfill

**Install WebExtension Polyfill**:
```bash
npm install webextension-polyfill
```

**In your scripts**:
```javascript
import browser from 'webextension-polyfill';

// Works across all browsers
browser.storage.local.get('key').then(result => {
  console.log(result);
});
```

#### 3. API Namespace Differences

| Browser | Primary Namespace | Promise Support |
|---------|------------------|-----------------|
| Chrome | `chrome.*` | Yes (MV3, Chrome 121+) |
| Firefox | `browser.*` | Yes (all versions) |
| Brave | `chrome.*` | Yes (Chromium-based) |
| Edge | `chrome.*` | Yes (Chromium-based) |

**Cross-browser solution**:
```javascript
// Option 1: Use polyfill (recommended)
import browser from 'webextension-polyfill';

// Option 2: Fallback pattern
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;
```

#### 4. Service Worker vs Background Scripts

**Chrome/Brave/Edge** (Manifest V3):
```json
{
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

**Firefox** (Manifest V3 - supports both):
```json
{
  "background": {
    "scripts": ["background.js"],
    "type": "module"
  }
}
```

**Best Practice**: Use separate manifest files or build process to handle differences.

---

## Extension Components

### 1. Service Worker (Background Script)

**Purpose**:
- Event-driven background logic
- API calls to external servers
- Extension lifecycle management
- Message handling

**Characteristics**:
- Runs in the background (no DOM access)
- Activates on events, shuts down when idle
- Cannot use `window`, `document`, or `localStorage`
- Use `chrome.storage` API instead

**Example**:
```javascript
// background.js
import browser from 'webextension-polyfill';

// Listen for messages from content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_FLASHCARD') {
    saveFlashcard(message.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

// Listen for extension installation
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    // Open onboarding page
    browser.tabs.create({ url: 'onboarding.html' });
  }
});

// API communication
async function saveFlashcard(data) {
  const { token } = await browser.storage.local.get('token');

  const response = await fetch('https://firstly-academy.com/api/flashcards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
```

### 2. Content Scripts

**Purpose**:
- Interact with web pages
- Read/modify page DOM
- Capture user interactions (text selection, clicks)
- Inject UI elements

**Characteristics**:
- Runs in isolated context (separate from page scripts)
- Has access to DOM but not page JavaScript variables
- Must use message passing to communicate with service worker

**Example**:
```javascript
// content.js
import browser from 'webextension-polyfill';

let selectedText = '';

// Capture text selection
document.addEventListener('mouseup', (event) => {
  const selection = window.getSelection();
  selectedText = selection.toString().trim();

  if (selectedText.length > 0) {
    showContextMenu(event);
  } else {
    hideContextMenu();
  }
});

// Show custom context menu
function showContextMenu(event) {
  // Remove existing menu
  hideContextMenu();

  const menu = document.createElement('div');
  menu.id = 'flashcard-context-menu';
  menu.className = 'flashcard-menu';
  menu.innerHTML = `
    <button id="save-flashcard-btn">
      💾 Save to Flashcards
    </button>
  `;

  // Position menu near selection
  menu.style.position = 'absolute';
  menu.style.left = `${event.pageX}px`;
  menu.style.top = `${event.pageY + 10}px`;

  document.body.appendChild(menu);

  // Add click handler
  document.getElementById('save-flashcard-btn').addEventListener('click', () => {
    saveToFlashcards(selectedText);
    hideContextMenu();
  });
}

function hideContextMenu() {
  const menu = document.getElementById('flashcard-context-menu');
  if (menu) {
    menu.remove();
  }
}

// Send message to background script
async function saveToFlashcards(text) {
  try {
    const response = await browser.runtime.sendMessage({
      type: 'SAVE_FLASHCARD',
      data: {
        word: text,
        context: getContextSentence(text),
        url: window.location.href,
        timestamp: Date.now()
      }
    });

    if (response.success) {
      showNotification('Saved to flashcards!');
    } else {
      showNotification('Error: ' + response.error, 'error');
    }
  } catch (error) {
    console.error('Failed to save flashcard:', error);
    showNotification('Failed to save', 'error');
  }
}

// Get surrounding context
function getContextSentence(text) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return '';

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const textContent = container.textContent || '';

  // Find sentence boundaries
  const beforeText = textContent.substring(0, range.startOffset);
  const afterText = textContent.substring(range.endOffset);

  const sentenceStart = Math.max(
    beforeText.lastIndexOf('.'),
    beforeText.lastIndexOf('!'),
    beforeText.lastIndexOf('?')
  ) + 1;

  const sentenceEnd = Math.min(
    afterText.indexOf('.'),
    afterText.indexOf('!'),
    afterText.indexOf('?')
  );

  const contextStart = sentenceStart;
  const contextEnd = range.endOffset + (sentenceEnd > 0 ? sentenceEnd : afterText.length);

  return textContent.substring(contextStart, contextEnd).trim();
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `flashcard-notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => notification.remove(), 3000);
}
```

**Content Script CSS**:
```css
/* content.css */
.flashcard-menu {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 8px;
  z-index: 999999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.flashcard-menu button {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}

.flashcard-menu button:hover {
  background: #45a049;
}

.flashcard-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #4CAF50;
  color: white;
  padding: 12px 20px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 999999;
  animation: slideIn 0.3s ease-out;
}

.flashcard-notification.error {
  background: #f44336;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

### 3. Popup UI

**Purpose**:
- User settings and preferences
- Authentication
- Quick actions
- Status display

**Example**:
```html
<!-- popup.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Flashcard Saver</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <div id="auth-section">
      <h2>Sign In to Firstly Academy</h2>
      <input type="text" id="email" placeholder="Email">
      <input type="password" id="password" placeholder="Password">
      <button id="login-btn">Sign In</button>
      <div id="error-message"></div>
    </div>

    <div id="main-section" style="display: none;">
      <div class="user-info">
        <span id="user-email"></span>
        <button id="logout-btn">Logout</button>
      </div>

      <div class="stats">
        <h3>Today's Flashcards</h3>
        <div id="stats-count">0</div>
      </div>

      <div class="settings">
        <label>
          <input type="checkbox" id="auto-detect">
          Auto-detect language
        </label>
        <label>
          <input type="checkbox" id="include-context">
          Include context sentence
        </label>
      </div>

      <button id="open-dashboard">Open Dashboard</button>
    </div>
  </div>

  <script src="popup.js" type="module"></script>
</body>
</html>
```

```javascript
// popup.js
import browser from 'webextension-polyfill';

document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is authenticated
  const { token, userEmail } = await browser.storage.local.get(['token', 'userEmail']);

  if (token) {
    showMainSection(userEmail);
  } else {
    showAuthSection();
  }

  // Setup event listeners
  document.getElementById('login-btn')?.addEventListener('click', handleLogin);
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('open-dashboard')?.addEventListener('click', openDashboard);
  document.getElementById('auto-detect')?.addEventListener('change', saveSettings);
  document.getElementById('include-context')?.addEventListener('change', saveSettings);
});

async function handleLogin() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('error-message');

  errorEl.textContent = '';

  try {
    const response = await fetch('https://firstly-academy.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const { token, user } = await response.json();

    await browser.storage.local.set({
      token,
      userEmail: user.email,
      userId: user.id
    });

    showMainSection(user.email);
  } catch (error) {
    errorEl.textContent = 'Login failed. Please check your credentials.';
  }
}

async function handleLogout() {
  await browser.storage.local.remove(['token', 'userEmail', 'userId']);
  showAuthSection();
}

function showAuthSection() {
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('main-section').style.display = 'none';
}

function showMainSection(email) {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('main-section').style.display = 'block';
  document.getElementById('user-email').textContent = email;
  loadStats();
}

async function loadStats() {
  try {
    const { token } = await browser.storage.local.get('token');
    const response = await fetch('https://firstly-academy.com/api/flashcards/stats/today', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const { count } = await response.json();
    document.getElementById('stats-count').textContent = count;
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

function openDashboard() {
  browser.tabs.create({ url: 'https://firstly-academy.com/dashboard' });
}

async function saveSettings() {
  const settings = {
    autoDetect: document.getElementById('auto-detect').checked,
    includeContext: document.getElementById('include-context').checked
  };

  await browser.storage.local.set({ settings });
}
```

---

## Authentication & Security

### Security Best Practices

#### 1. Never Store Credentials in Plain Text
```javascript
// ❌ BAD
await browser.storage.local.set({ password: userPassword });

// ✅ GOOD - Only store tokens
await browser.storage.local.set({ token: authToken });
```

#### 2. Use HTTPS for All API Calls
```javascript
// ❌ BAD
const response = await fetch('http://api.example.com/data');

// ✅ GOOD
const response = await fetch('https://api.example.com/data');
```

#### 3. Validate and Sanitize User Input
```javascript
function sanitizeText(text) {
  // Remove potentially dangerous characters
  return text
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 500); // Limit length
}
```

#### 4. Use Content Security Policy
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

#### 5. Request Minimum Permissions
```json
{
  "permissions": [
    "storage",        // Only what you need
    "activeTab"       // Not "tabs" unless necessary
  ],
  "host_permissions": [
    "https://firstly-academy.com/*"  // Specific domains only
  ]
}
```

### Authentication Flow

```javascript
// auth.js - Authentication module
export class AuthManager {
  static async login(email, password) {
    const response = await fetch('https://firstly-academy.com/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Authentication failed');
    }

    const { token, refreshToken, user } = await response.json();

    // Store tokens securely
    await browser.storage.local.set({
      token,
      refreshToken,
      userId: user.id,
      userEmail: user.email,
      tokenExpiry: Date.now() + (3600 * 1000) // 1 hour
    });

    return user;
  }

  static async refreshToken() {
    const { refreshToken } = await browser.storage.local.get('refreshToken');

    const response = await fetch('https://firstly-academy.com/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    });

    const { token, tokenExpiry } = await response.json();

    await browser.storage.local.set({
      token,
      tokenExpiry: Date.now() + tokenExpiry
    });

    return token;
  }

  static async getValidToken() {
    const { token, tokenExpiry } = await browser.storage.local.get(['token', 'tokenExpiry']);

    // Check if token is expired or about to expire (5 min buffer)
    if (!token || Date.now() > tokenExpiry - 300000) {
      return await this.refreshToken();
    }

    return token;
  }

  static async logout() {
    await browser.storage.local.remove([
      'token',
      'refreshToken',
      'userId',
      'userEmail',
      'tokenExpiry'
    ]);
  }

  static async isAuthenticated() {
    const { token } = await browser.storage.local.get('token');
    return !!token;
  }
}
```

---

## Text Selection & Highlighting

### Advanced Text Selection Techniques

```javascript
// selection-handler.js
export class SelectionHandler {
  constructor() {
    this.selectionRange = null;
    this.selectedText = '';
  }

  /**
   * Get selected text with metadata
   */
  getSelection() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    this.selectedText = selection.toString().trim();
    this.selectionRange = selection.getRangeAt(0);

    if (!this.selectedText) {
      return null;
    }

    return {
      text: this.selectedText,
      context: this.getContext(),
      position: this.getPosition(),
      metadata: this.getMetadata()
    };
  }

  /**
   * Get surrounding context (full sentence)
   */
  getContext() {
    if (!this.selectionRange) return '';

    const range = this.selectionRange.cloneRange();
    const container = range.commonAncestorContainer;

    // Expand to paragraph or sentence
    let textContent = '';

    if (container.nodeType === Node.TEXT_NODE) {
      textContent = container.textContent;
    } else {
      textContent = container.textContent || '';
    }

    const selectedPosition = range.startOffset;

    // Find sentence boundaries
    const sentenceBoundaries = ['.', '!', '?', '\n'];

    let start = 0;
    let end = textContent.length;

    // Find start of sentence
    for (let i = selectedPosition - 1; i >= 0; i--) {
      if (sentenceBoundaries.includes(textContent[i])) {
        start = i + 1;
        break;
      }
    }

    // Find end of sentence
    for (let i = selectedPosition; i < textContent.length; i++) {
      if (sentenceBoundaries.includes(textContent[i])) {
        end = i + 1;
        break;
      }
    }

    return textContent.substring(start, end).trim();
  }

  /**
   * Get position for highlighting restoration
   */
  getPosition() {
    if (!this.selectionRange) return null;

    const rect = this.selectionRange.getBoundingClientRect();

    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    };
  }

  /**
   * Get additional metadata
   */
  getMetadata() {
    return {
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
      domain: window.location.hostname,
      language: document.documentElement.lang || 'unknown'
    };
  }

  /**
   * Highlight selected text
   */
  highlightSelection(color = '#FFEB3B', persist = false) {
    if (!this.selectionRange) return null;

    const span = document.createElement('span');
    span.className = 'flashcard-highlight';
    span.style.backgroundColor = color;
    span.dataset.flashcardId = Date.now().toString();

    try {
      this.selectionRange.surroundContents(span);

      if (persist) {
        this.saveHighlight(span);
      }

      return span.dataset.flashcardId;
    } catch (error) {
      console.error('Failed to highlight:', error);
      return null;
    }
  }

  /**
   * Save highlight for persistence
   */
  async saveHighlight(highlightElement) {
    const data = {
      id: highlightElement.dataset.flashcardId,
      text: this.selectedText,
      url: window.location.href,
      xpath: this.getXPath(highlightElement)
    };

    const { highlights = [] } = await browser.storage.local.get('highlights');
    highlights.push(data);
    await browser.storage.local.set({ highlights });
  }

  /**
   * Get XPath for element (for persistence)
   */
  getXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    if (element === document.body) {
      return '/html/body';
    }

    let ix = 0;
    const siblings = element.parentNode.childNodes;

    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];

      if (sibling === element) {
        return `${this.getXPath(element.parentNode)}/${element.tagName.toLowerCase()}[${ix + 1}]`;
      }

      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
  }

  /**
   * Restore highlights on page load
   */
  async restoreHighlights() {
    const { highlights = [] } = await browser.storage.local.get('highlights');
    const currentUrl = window.location.href;

    const pageHighlights = highlights.filter(h => h.url === currentUrl);

    for (const highlight of pageHighlights) {
      try {
        const element = document.evaluate(
          highlight.xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;

        if (element) {
          element.classList.add('flashcard-highlight');
          element.dataset.flashcardId = highlight.id;
        }
      } catch (error) {
        console.error('Failed to restore highlight:', error);
      }
    }
  }
}
```

### Context Menu Integration

```json
// manifest.json
{
  "permissions": [
    "contextMenus"
  ]
}
```

```javascript
// background.js - Context menu setup
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'save-to-flashcards',
    title: 'Save "%s" to Flashcards',
    contexts: ['selection']
  });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-to-flashcards') {
    // Send message to content script
    browser.tabs.sendMessage(tab.id, {
      type: 'SAVE_SELECTION',
      text: info.selectionText
    });
  }
});
```

---

## Server Communication

### API Client Pattern

```javascript
// api-client.js
import browser from 'webextension-polyfill';
import { AuthManager } from './auth.js';

export class APIClient {
  constructor(baseURL = 'https://firstly-academy.com/api') {
    this.baseURL = baseURL;
  }

  /**
   * Make authenticated request
   */
  async request(endpoint, options = {}) {
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

    const response = await fetch(`${this.baseURL}${endpoint}`, config);

    if (response.status === 401) {
      // Token invalid, logout user
      await AuthManager.logout();
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Save flashcard
   */
  async saveFlashcard(data) {
    return this.request('/flashcards', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Get user flashcards
   */
  async getFlashcards(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/flashcards?${query}`);
  }

  /**
   * Update flashcard
   */
  async updateFlashcard(id, data) {
    return this.request(`/flashcards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  /**
   * Delete flashcard
   */
  async deleteFlashcard(id) {
    return this.request(`/flashcards/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get today's stats
   */
  async getTodayStats() {
    return this.request('/flashcards/stats/today');
  }
}
```

### Offline Support with Queue

```javascript
// offline-queue.js
export class OfflineQueue {
  constructor() {
    this.queueKey = 'offline_queue';
  }

  /**
   * Add item to queue
   */
  async enqueue(item) {
    const { [this.queueKey]: queue = [] } = await browser.storage.local.get(this.queueKey);

    queue.push({
      ...item,
      id: Date.now(),
      timestamp: Date.now()
    });

    await browser.storage.local.set({ [this.queueKey]: queue });
  }

  /**
   * Process queue when online
   */
  async processQueue(apiClient) {
    const { [this.queueKey]: queue = [] } = await browser.storage.local.get(this.queueKey);

    if (queue.length === 0) return;

    const processed = [];
    const failed = [];

    for (const item of queue) {
      try {
        await apiClient.saveFlashcard(item.data);
        processed.push(item.id);
      } catch (error) {
        console.error('Failed to process queue item:', error);
        failed.push(item);
      }
    }

    // Keep only failed items
    await browser.storage.local.set({ [this.queueKey]: failed });

    return { processed: processed.length, failed: failed.length };
  }

  /**
   * Get queue size
   */
  async getQueueSize() {
    const { [this.queueKey]: queue = [] } = await browser.storage.local.get(this.queueKey);
    return queue.length;
  }
}

// Usage in background.js
const offlineQueue = new OfflineQueue();
const apiClient = new APIClient();

// Check for internet connection
window.addEventListener('online', async () => {
  const result = await offlineQueue.processQueue(apiClient);
  console.log(`Processed ${result.processed} items, ${result.failed} failed`);
});
```

---

## Storage Patterns

### Storage API Best Practices

```javascript
// storage-manager.js
export class StorageManager {
  /**
   * Get item with default value
   */
  static async get(key, defaultValue = null) {
    const result = await browser.storage.local.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
  }

  /**
   * Set item
   */
  static async set(key, value) {
    await browser.storage.local.set({ [key]: value });
  }

  /**
   * Remove item
   */
  static async remove(key) {
    await browser.storage.local.remove(key);
  }

  /**
   * Clear all storage
   */
  static async clear() {
    await browser.storage.local.clear();
  }

  /**
   * Get storage usage
   */
  static async getUsage() {
    const bytes = await browser.storage.local.getBytesInUse();
    return {
      bytes,
      kb: (bytes / 1024).toFixed(2),
      mb: (bytes / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * Listen for storage changes
   */
  static onChange(callback) {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        callback(changes);
      }
    });
  }
}

// Storage limits
// Chrome: 10MB for local storage, unlimited for sync
// Firefox: 10MB for local storage
```

### Sync Storage for User Preferences

```javascript
// preferences.js
export class Preferences {
  static defaults = {
    autoDetectLanguage: true,
    includeContext: true,
    highlightColor: '#FFEB3B',
    notificationsEnabled: true,
    syncEnabled: true
  };

  /**
   * Get user preferences
   */
  static async get() {
    const prefs = await browser.storage.sync.get('preferences');
    return { ...this.defaults, ...prefs.preferences };
  }

  /**
   * Update preferences
   */
  static async set(updates) {
    const current = await this.get();
    const updated = { ...current, ...updates };
    await browser.storage.sync.set({ preferences: updated });
    return updated;
  }

  /**
   * Reset to defaults
   */
  static async reset() {
    await browser.storage.sync.set({ preferences: this.defaults });
    return this.defaults;
  }
}
```

---

## Performance Optimization

### 1. Lazy Loading

```javascript
// Only load heavy libraries when needed
let languageDetector = null;

async function detectLanguage(text) {
  if (!languageDetector) {
    const module = await import('./lib/language-detector.js');
    languageDetector = new module.LanguageDetector();
  }

  return languageDetector.detect(text);
}
```

### 2. Debouncing and Throttling

```javascript
// utils.js
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Usage
const debouncedSave = debounce(saveFlashcard, 500);
```

### 3. Batch Operations

```javascript
// Batch multiple saves
class BatchProcessor {
  constructor(processFn, delay = 1000) {
    this.processFn = processFn;
    this.delay = delay;
    this.batch = [];
    this.timer = null;
  }

  add(item) {
    this.batch.push(item);

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => this.flush(), this.delay);
  }

  async flush() {
    if (this.batch.length === 0) return;

    const items = [...this.batch];
    this.batch = [];

    await this.processFn(items);
  }
}

// Usage
const batchSaver = new BatchProcessor(async (items) => {
  await apiClient.request('/flashcards/batch', {
    method: 'POST',
    body: JSON.stringify({ flashcards: items })
  });
});
```

### 4. Memory Management in Service Workers

```javascript
// Service workers shut down when idle
// Store state in storage, not in-memory variables

// ❌ BAD - State lost when service worker shuts down
let userCache = {};

// ✅ GOOD - Persist state
async function getUserData(userId) {
  const cache = await browser.storage.local.get('userCache');

  if (cache.userCache?.[userId]) {
    return cache.userCache[userId];
  }

  const userData = await fetchUserData(userId);

  await browser.storage.local.set({
    userCache: {
      ...cache.userCache,
      [userId]: userData
    }
  });

  return userData;
}
```

---

## Testing & Debugging

### Testing Tools

```javascript
// test-utils.js
export class ExtensionTester {
  /**
   * Mock browser API
   */
  static mockBrowserAPI() {
    global.browser = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn(),
          remove: jest.fn()
        }
      },
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn()
        }
      }
    };
  }

  /**
   * Test content script injection
   */
  static async testContentScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content.js');
    document.head.appendChild(script);

    // Wait for script to load
    await new Promise(resolve => {
      script.onload = resolve;
    });
  }
}
```

### Debugging Tips

1. **Enable Developer Mode**
   - Chrome: `chrome://extensions` → Enable "Developer mode"
   - Firefox: `about:debugging` → "This Firefox"

2. **Inspect Service Worker**
   - Chrome: Extensions page → Click "Service worker" link
   - Firefox: about:debugging → Inspect

3. **View Console Logs**
   ```javascript
   // background.js
   console.log('Background:', message);

   // content.js
   console.log('Content:', message);

   // Different consoles!
   ```

4. **Debug Message Passing**
   ```javascript
   browser.runtime.onMessage.addListener((message, sender) => {
     console.log('Received:', message, 'from:', sender);
     return true;
   });
   ```

5. **Test in Incognito/Private Mode**
   - Ensure extension works without normal browsing data

---

## Publishing & Distribution

### Pre-Publishing Checklist

- [ ] Test in all target browsers (Chrome, Firefox, Brave)
- [ ] Test authentication flow
- [ ] Test offline functionality
- [ ] Validate all permissions are necessary
- [ ] Review content security policy
- [ ] Check for security vulnerabilities
- [ ] Optimize images and assets
- [ ] Create privacy policy
- [ ] Write clear description and screenshots
- [ ] Test installation and onboarding flow

### Chrome Web Store

1. **Create Developer Account**: $5 one-time fee
2. **Prepare Assets**:
   - Icon: 128x128px
   - Screenshots: 1280x800px or 640x400px
   - Promotional images (optional)
3. **Upload Extension**: ZIP file of extension directory
4. **Fill Store Listing**: Description, category, etc.
5. **Review Process**: 1-3 days typically

### Firefox Add-ons

1. **Create Account**: Free at addons.mozilla.org
2. **Submit Extension**: ZIP or XPI file
3. **Validation**: Automatic validation runs
4. **Review**: Manual review for listed extensions
5. **Self-Distribution**: Can distribute without review

### Build Process

```javascript
// build.js
const fs = require('fs-extra');
const archiver = require('archiver');

async function build(browser) {
  const dist = `dist/${browser}`;

  // Clean dist
  await fs.emptyDir(dist);

  // Copy common files
  await fs.copy('src', dist);

  // Copy browser-specific manifest
  await fs.copy(`manifests/manifest.${browser}.json`, `${dist}/manifest.json`);

  // Create ZIP
  const output = fs.createWriteStream(`${browser}-extension.zip`);
  const archive = archiver('zip');

  archive.pipe(output);
  archive.directory(dist, false);
  await archive.finalize();

  console.log(`Built ${browser} extension`);
}

// Build for all browsers
async function buildAll() {
  await build('chrome');
  await build('firefox');
}

buildAll();
```

---

## Common Pitfalls & Solutions

### 1. Content Script Isolation

**Problem**: Can't access page variables from content script

```javascript
// ❌ Won't work - different execution contexts
const pageVar = window.myPageVariable;
```

**Solution**: Inject script into page context

```javascript
// ✅ Works
const script = document.createElement('script');
script.textContent = `
  // This runs in page context
  window.postMessage({
    type: 'PAGE_DATA',
    data: window.myPageVariable
  }, '*');
`;
document.documentElement.appendChild(script);
script.remove();

// Listen for message
window.addEventListener('message', (event) => {
  if (event.data.type === 'PAGE_DATA') {
    console.log(event.data.data);
  }
});
```

### 2. Service Worker Timeout

**Problem**: Service worker shuts down, losing state

**Solution**: Persist state in storage

```javascript
// ❌ State lost
let counter = 0;

// ✅ State persisted
async function incrementCounter() {
  const { counter = 0 } = await browser.storage.local.get('counter');
  await browser.storage.local.set({ counter: counter + 1 });
}
```

### 3. CORS Issues

**Problem**: Can't fetch from external API

```javascript
// ❌ CORS error in content script
fetch('https://api.example.com/data');
```

**Solution**: Make request from background/service worker

```javascript
// ✅ In background.js
browser.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'FETCH_DATA') {
    const response = await fetch('https://api.example.com/data');
    return response.json();
  }
});

// In content script
const data = await browser.runtime.sendMessage({ type: 'FETCH_DATA' });
```

### 4. Dynamic Import in Service Workers

**Problem**: `import()` doesn't work in service workers

**Solution**: Use `importScripts()` or static imports

```javascript
// ✅ For Manifest V3 with type: "module"
import { feature } from './lib/feature.js';

// ✅ For older implementations
self.importScripts('lib/feature.js');
```

### 5. Context Menu Not Appearing

**Problem**: Context menu doesn't show on selection

**Solution**: Check permissions and contexts

```json
{
  "permissions": ["contextMenus"],
  "contexts": ["selection"]
}
```

---

## Additional Resources

### Official Documentation
- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Firefox Extensions Documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [WebExtension Polyfill](https://github.com/mozilla/webextension-polyfill)

### Tools & Libraries
- [webextension-polyfill](https://www.npmjs.com/package/webextension-polyfill) - Cross-browser compatibility
- [web-ext](https://github.com/mozilla/web-ext) - Command-line tool for development
- [Chrome Extension CLI](https://github.com/dutiyesh/chrome-extension-cli) - Scaffold extensions

### Communities
- [r/browserextensions](https://reddit.com/r/browserextensions)
- [Chrome Extensions Discord](https://discord.gg/chromeextensions)
- Stack Overflow: `[browser-extension]` tag

---

## Conclusion

Building a cross-browser extension requires attention to:
1. **Standards compliance** - Use Manifest V3 and browser namespace
2. **Security** - Validate inputs, use HTTPS, minimize permissions
3. **Performance** - Optimize for service worker lifecycle
4. **User experience** - Smooth authentication, offline support
5. **Compatibility** - Test across all target browsers

This guide provides a solid foundation for building production-ready browser extensions that work seamlessly across Chrome, Brave, and Firefox.

---

**Last Updated**: 2025
**Version**: 1.0.0
