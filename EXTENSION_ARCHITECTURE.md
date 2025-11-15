# Firstly Academy Flashcard Extension - Architecture Design

## Overview

This browser extension enables users to highlight text on any website and save it directly to their Firstly Academy flashcard collection for language learning.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Popup UI   │  │  Context     │  │  Notification    │  │
│  │  (Settings   │  │  Menu        │  │  Toasts          │  │
│  │   & Auth)    │  │              │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension Layer                   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Content Script (content.js)              │  │
│  │  - Text selection capture                             │  │
│  │  - UI injection (highlight menu)                      │  │
│  │  - Highlight visualization                            │  │
│  │  - Context sentence extraction                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        Background Service Worker (background.js)      │  │
│  │  - Message routing                                    │  │
│  │  - API communication                                  │  │
│  │  - Authentication management                          │  │
│  │  - Offline queue processing                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Utility Modules                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Auth       │  │  API Client  │  │  Storage         │  │
│  │   Manager    │  │              │  │  Manager         │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Selection  │  │  Offline     │  │  Preferences     │  │
│  │   Handler    │  │  Queue       │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Firstly Academy Backend API                 │
├─────────────────────────────────────────────────────────────┤
│  POST   /api/auth/login                                      │
│  POST   /api/auth/refresh                                    │
│  POST   /api/flashcards                                      │
│  GET    /api/flashcards                                      │
│  PATCH  /api/flashcards/:id                                  │
│  DELETE /api/flashcards/:id                                  │
│  GET    /api/flashcards/stats/today                          │
│  POST   /api/flashcards/batch                                │
└─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Content Script (`content.js`)

**Responsibilities**:
- Detect and capture text selection
- Display floating action menu on text selection
- Extract context sentences
- Visual feedback (highlighting)
- Inject custom UI elements into pages

**Key Features**:
- Event-driven text selection
- Smart context extraction (full sentences)
- Non-intrusive UI
- Page metadata collection (URL, title, timestamp)

**Communication**:
- Sends messages to background worker
- Receives configuration from storage

### 2. Background Service Worker (`background.js`)

**Responsibilities**:
- Central message router
- API communication with Firstly Academy
- Authentication token management
- Offline queue management
- Context menu registration

**Key Features**:
- Event-driven architecture (Manifest V3)
- Automatic token refresh
- Retry logic with exponential backoff
- Offline data persistence

**Communication**:
- Receives messages from content scripts and popup
- Makes authenticated API requests
- Updates storage

### 3. Popup UI (`popup.html` + `popup.js`)

**Responsibilities**:
- User authentication (login/logout)
- Extension settings
- Statistics display
- Quick access to dashboard

**Key Features**:
- Responsive design
- Real-time stats
- Settings persistence via sync storage
- Visual feedback for actions

### 4. Utility Modules

#### AuthManager (`lib/auth.js`)
- Login/logout flows
- Token storage and validation
- Automatic token refresh
- Session management

#### APIClient (`lib/api-client.js`)
- Centralized API communication
- Request/response handling
- Error handling and retry logic
- Request authentication

#### StorageManager (`lib/storage.js`)
- Abstraction over browser.storage API
- Default value handling
- Storage event listeners
- Usage monitoring

#### SelectionHandler (`lib/selection.js`)
- Text selection capture
- Context extraction
- Highlighting logic
- XPath generation for persistence

#### OfflineQueue (`lib/offline-queue.js`)
- Queue management for offline saves
- Automatic sync when online
- Failure handling

#### Preferences (`lib/preferences.js`)
- User preferences management
- Default settings
- Sync storage integration

## Data Flow

### Saving a Flashcard

```
1. User selects text on webpage
   ↓
2. Content script captures selection
   ↓
3. Content script shows action menu
   ↓
4. User clicks "Save to Flashcards"
   ↓
5. Content script extracts:
   - Selected text
   - Context sentence
   - Page metadata (URL, title, etc.)
   ↓
6. Content script sends message to background worker
   ↓
7. Background worker checks authentication
   ↓
8. Background worker makes API request to save flashcard
   ↓
9. If online: Direct API call
   If offline: Add to queue
   ↓
10. Background worker returns result to content script
    ↓
11. Content script shows notification toast
    ↓
12. Content script highlights saved text (optional)
```

### Authentication Flow

```
1. User opens extension popup
   ↓
2. Popup checks for stored auth token
   ↓
3. If no token: Show login form
   If token exists: Show main interface
   ↓
4. User enters credentials
   ↓
5. Popup sends login request via background worker
   ↓
6. Background worker calls /api/auth/login
   ↓
7. On success: Store token and user data
   ↓
8. Popup updates to show authenticated state
```

### Offline Sync Flow

```
1. User saves flashcard while offline
   ↓
2. Background worker detects offline state
   ↓
3. Item added to offline queue in storage
   ↓
4. User notification: "Saved locally, will sync when online"
   ↓
5. Browser comes online (online event)
   ↓
6. Background worker processes queue
   ↓
7. For each queued item:
   - Attempt API save
   - On success: Remove from queue
   - On failure: Keep in queue for retry
   ↓
8. Notify user of sync completion
```

## API Contract

### Expected Backend Endpoints

#### Authentication

```typescript
// POST /api/auth/login
Request: {
  email: string;
  password: string;
}

Response: {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  expiresIn: number; // seconds
}
```

```typescript
// POST /api/auth/refresh
Request: {
  refreshToken: string;
}

Response: {
  token: string;
  expiresIn: number;
}
```

#### Flashcards

```typescript
// POST /api/flashcards
Request: {
  word: string;
  context?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  language?: string;
  timestamp: number;
}

Response: {
  id: string;
  word: string;
  context: string;
  sourceUrl: string;
  sourceTitle: string;
  language: string;
  createdAt: string;
  userId: string;
}
```

```typescript
// GET /api/flashcards
Query Parameters:
  - limit: number (default: 50)
  - offset: number (default: 0)
  - language?: string

Response: {
  flashcards: Flashcard[];
  total: number;
  limit: number;
  offset: number;
}
```

```typescript
// GET /api/flashcards/stats/today
Response: {
  count: number;
  date: string;
}
```

```typescript
// POST /api/flashcards/batch
Request: {
  flashcards: Array<{
    word: string;
    context?: string;
    sourceUrl?: string;
    sourceTitle?: string;
    language?: string;
    timestamp: number;
  }>;
}

Response: {
  saved: number;
  failed: number;
  results: Array<{
    success: boolean;
    id?: string;
    error?: string;
  }>;
}
```

## Storage Schema

### Local Storage (browser.storage.local)

```typescript
{
  // Authentication
  token: string;
  refreshToken: string;
  userId: string;
  userEmail: string;
  tokenExpiry: number; // timestamp

  // Offline queue
  offline_queue: Array<{
    id: number;
    data: FlashcardData;
    timestamp: number;
  }>;

  // Highlights (for persistence across page reloads)
  highlights: Array<{
    id: string;
    text: string;
    url: string;
    xpath: string;
  }>;

  // Cache
  userCache: {
    [userId: string]: UserData;
  };

  // Stats cache
  todayStats: {
    count: number;
    date: string;
    lastUpdated: number;
  };
}
```

### Sync Storage (browser.storage.sync)

```typescript
{
  preferences: {
    autoDetectLanguage: boolean;
    includeContext: boolean;
    highlightColor: string;
    notificationsEnabled: boolean;
    syncEnabled: boolean;
    defaultLanguage?: string;
  };
}
```

## Security Considerations

1. **Token Storage**: Store only JWT tokens, never passwords
2. **HTTPS Only**: All API communication over HTTPS
3. **Input Sanitization**: Sanitize all user input before sending to API
4. **Content Security Policy**: Strict CSP in manifest
5. **Minimal Permissions**: Request only necessary permissions
6. **XSS Protection**: Escape all content injected into DOM
7. **Token Expiry**: Automatic token refresh with expiry checking

## Performance Optimizations

1. **Lazy Loading**: Load heavy libraries only when needed
2. **Debouncing**: Debounce text selection events
3. **Batch Operations**: Batch multiple flashcard saves
4. **Caching**: Cache user data and stats
5. **Service Worker Lifecycle**: Persist state in storage, not memory
6. **Minimal DOM Manipulation**: Optimize content script DOM operations

## Cross-Browser Compatibility

1. **WebExtension Polyfill**: Use `webextension-polyfill` for API compatibility
2. **Manifest Variants**: Separate manifests for Chrome and Firefox if needed
3. **Build Process**: Automated build for different browsers
4. **Testing**: Test on Chrome, Firefox, and Brave before release

## Extension Permissions

```json
{
  "permissions": [
    "storage",           // For storing auth tokens and preferences
    "activeTab",         // For accessing current tab
    "contextMenus"       // For right-click context menu
  ],
  "host_permissions": [
    "https://firstly-academy.com/*"  // For API communication
  ]
}
```

## Development Workflow

1. **Local Development**:
   - Load unpacked extension in browser
   - Use `web-ext run` for Firefox
   - Hot reload for development

2. **Testing**:
   - Unit tests for utility modules
   - Integration tests for API client
   - Manual testing across browsers

3. **Build**:
   - Separate builds for Chrome and Firefox
   - Minification and optimization
   - Asset optimization

4. **Distribution**:
   - Chrome Web Store
   - Firefox Add-ons (AMO)
   - Direct distribution (for Brave)

## Future Enhancements

1. **Language Detection**: Automatic language detection for flashcards
2. **AI Definitions**: Fetch definitions and translations
3. **Audio Pronunciation**: Add pronunciation audio
4. **Image Context**: Capture screenshots with highlights
5. **Spaced Repetition**: In-extension review reminders
6. **Collaborative Learning**: Share flashcard collections
7. **Import/Export**: Backup and restore flashcards
8. **Analytics**: Usage statistics and learning progress

## File Structure

```
firstly-academy-extension/
├── manifest.json
├── manifest.firefox.json
├── background.js
├── content.js
├── content.css
├── popup.html
├── popup.js
├── popup.css
├── lib/
│   ├── auth.js
│   ├── api-client.js
│   ├── storage.js
│   ├── selection.js
│   ├── offline-queue.js
│   └── preferences.js
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── assets/
│   └── styles/
│       └── common.css
└── README.md
```

## Conclusion

This architecture provides a robust, scalable foundation for the Firstly Academy flashcard browser extension, with emphasis on:
- User experience
- Performance
- Security
- Cross-browser compatibility
- Offline functionality
- Future extensibility
