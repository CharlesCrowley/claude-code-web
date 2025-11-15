# Firstly Academy Flashcard Saver

A browser extension for Chrome, Brave, and Firefox that allows you to save highlighted text from any website directly to your Firstly Academy flashcard collection for language learning.

## Features

- **One-Click Save**: Highlight any text on a webpage and save it to your flashcards
- **Context Preservation**: Automatically captures the full sentence for better learning context
- **Cross-Browser Support**: Works on Chrome, Brave, and Firefox
- **Offline Mode**: Queue flashcards when offline and auto-sync when back online
- **Customizable Highlights**: Choose your preferred highlight color
- **Smart Detection**: Auto-detect language of captured content
- **Visual Feedback**: See saved highlights on the page
- **Privacy-First**: No tracking, minimal permissions required

## Installation

### For Development/Testing

#### Chrome/Brave

1. Download or clone this repository
2. Open Chrome/Brave and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `browser-extension` folder
6. The extension icon should appear in your toolbar

#### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Navigate to the `browser-extension` folder and select `manifest.firefox.json`
6. The extension will be loaded temporarily (removed when Firefox restarts)

### Production Installation

Once published to the official stores:

- **Chrome/Brave**: Visit the Chrome Web Store and click "Add to Chrome"
- **Firefox**: Visit Firefox Add-ons (AMO) and click "Add to Firefox"

## Requirements

### Browser Icons

Before using the extension, you need to create icon files. See `icons/ICON_INSTRUCTIONS.md` for detailed instructions.

Required icon files:
- `icons/icon-16.png` (16x16px)
- `icons/icon-48.png` (48x48px)
- `icons/icon-128.png` (128x128px)

### Backend API

This extension requires a Firstly Academy backend API with the following endpoints:

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh authentication token

#### Flashcards
- `POST /api/flashcards` - Create flashcard
- `GET /api/flashcards` - List flashcards
- `PATCH /api/flashcards/:id` - Update flashcard
- `DELETE /api/flashcards/:id` - Delete flashcard
- `GET /api/flashcards/stats/today` - Get today's stats
- `POST /api/flashcards/batch` - Batch create flashcards

See `../EXTENSION_ARCHITECTURE.md` for detailed API contract specifications.

## Usage

### First Time Setup

1. Click the extension icon in your browser toolbar
2. Sign in with your Firstly Academy credentials
3. Adjust settings as needed (highlight color, context inclusion, etc.)

### Saving Flashcards

**Method 1: Selection Menu**
1. Highlight any text on a webpage
2. A floating menu will appear
3. Click "Save to Flashcards"
4. The text will be saved and highlighted

**Method 2: Context Menu (Right-Click)**
1. Highlight any text on a webpage
2. Right-click on the selection
3. Choose "Save to Flashcards" from the context menu

### Managing Settings

Click the extension icon to access:
- **Include context**: Toggle full sentence capture
- **Auto-detect language**: Automatically detect content language
- **Notifications**: Show/hide save confirmations
- **Highlight color**: Choose from 6 preset colors
- **Today's stats**: View flashcards saved today
- **Offline queue**: See pending syncs

### Offline Mode

When you're offline:
1. Save flashcards as normal
2. They're queued locally
3. When you're back online, they sync automatically
4. View pending syncs in the popup

## Development

### Project Structure

```
browser-extension/
├── manifest.json              # Chrome/Brave manifest
├── manifest.firefox.json      # Firefox manifest
├── background.js              # Service worker (background script)
├── content.js                 # Content script (injected into pages)
├── content.css                # Content script styles
├── popup.html                 # Extension popup HTML
├── popup.js                   # Popup logic
├── popup.css                  # Popup styles
├── lib/                       # Utility modules
│   ├── auth.js               # Authentication manager
│   ├── api-client.js         # API communication
│   ├── storage.js            # Storage abstraction
│   ├── preferences.js        # User preferences
│   ├── offline-queue.js      # Offline queue management
│   └── selection.js          # Text selection handler
├── icons/                     # Extension icons
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```

### Technology Stack

- **Manifest V3**: Latest extension standard
- **ES Modules**: Modern JavaScript modules
- **Vanilla JS**: No framework dependencies
- **Browser Storage API**: For data persistence
- **Fetch API**: For network requests

### Development Workflow

1. **Make changes** to source files
2. **Reload extension**:
   - Chrome: Visit `chrome://extensions/` and click reload
   - Firefox: Visit `about:debugging` and click reload
3. **Test** on various websites
4. **Debug**:
   - Content script: Open DevTools on webpage
   - Background script: Click "Service worker" on extensions page
   - Popup: Right-click popup → Inspect

### Testing

Test the extension on various scenarios:

- ✅ Authentication (login/logout)
- ✅ Save flashcard (online)
- ✅ Save flashcard (offline)
- ✅ Offline queue sync
- ✅ Settings persistence
- ✅ Context extraction
- ✅ Highlight visualization
- ✅ Different text selections (single word, phrase, sentence)
- ✅ Special characters and Unicode
- ✅ Different websites (news, blogs, documentation)
- ✅ Cross-browser compatibility

### Building for Production

#### Chrome/Brave

1. Ensure all files are in the `browser-extension` folder
2. Create a ZIP file:
   ```bash
   cd browser-extension
   zip -r flashcard-saver-chrome.zip . -x "*.git*" -x "manifest.firefox.json"
   ```
3. Upload to Chrome Web Store Developer Dashboard

#### Firefox

1. Use the Firefox manifest:
   ```bash
   cd browser-extension
   cp manifest.firefox.json manifest.json
   ```
2. Create a ZIP file:
   ```bash
   zip -r flashcard-saver-firefox.zip . -x "*.git*"
   ```
3. Upload to Firefox Add-ons Developer Hub

#### Automated Build Script

Create a `build.sh` script:

```bash
#!/bin/bash

# Create dist directory
mkdir -p dist

# Build Chrome version
echo "Building Chrome version..."
cd browser-extension
zip -r ../dist/flashcard-saver-chrome.zip . -x "*.git*" -x "manifest.firefox.json" -x "*.md"

# Build Firefox version
echo "Building Firefox version..."
cp manifest.json manifest.backup.json
cp manifest.firefox.json manifest.json
zip -r ../dist/flashcard-saver-firefox.zip . -x "*.git*" -x "manifest.backup.json" -x "*.md"
mv manifest.backup.json manifest.json

echo "Build complete! Check dist/ folder"
```

## Configuration

### API Base URL

To change the API base URL, edit:
- `lib/auth.js` - Line with `const API_BASE_URL`
- `lib/api-client.js` - Line with `const API_BASE_URL`

### Default Settings

To change default settings, edit:
- `lib/preferences.js` - `defaults` object

## Permissions

This extension requires minimal permissions:

- **storage**: Store authentication tokens and preferences
- **activeTab**: Access current tab for text selection
- **contextMenus**: Add right-click context menu
- **host_permissions**: Access to `firstly-academy.com` for API calls

## Security

- ✅ Tokens stored locally (never passwords)
- ✅ HTTPS-only API communication
- ✅ Content Security Policy enforced
- ✅ Input sanitization
- ✅ Minimal permissions requested
- ✅ No external scripts loaded
- ✅ No tracking or analytics

## Troubleshooting

### Extension doesn't appear
- Make sure you've loaded it in developer mode
- Check that all required files are present
- Check browser console for errors

### Can't save flashcards
- Verify you're signed in (click extension icon)
- Check your internet connection
- Verify API endpoint is accessible
- Check browser console for errors

### Offline queue not syncing
- Ensure you're online
- Click "Sync Now" in the popup
- Check background service worker logs

### Highlights not showing
- Ensure highlight color is selected in settings
- Some websites may override styles
- Try refreshing the page

### Context menu not appearing
- Make sure you've selected text first
- Wait a moment after selection
- Try right-clicking on the selection

## Browser Compatibility

| Browser | Minimum Version | Status |
|---------|----------------|---------|
| Chrome  | 121+          | ✅ Full support |
| Brave   | 1.62+         | ✅ Full support |
| Firefox | 109+          | ✅ Full support |
| Edge    | 121+          | ⚠️  Should work (untested) |
| Safari  | -             | ❌ Not supported |

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly across browsers
5. Submit a pull request

## License

[Your License Here]

## Support

For issues and feature requests:
- GitHub Issues: [Your repo URL]
- Email: support@firstly-academy.com
- Documentation: [Your docs URL]

## Changelog

### Version 1.0.0 (Initial Release)
- Text selection and highlighting
- Flashcard saving with context
- Offline queue support
- Cross-browser compatibility
- User authentication
- Settings management
- Context menu integration

## Roadmap

Future enhancements:
- [ ] Language detection API integration
- [ ] AI-powered definitions and translations
- [ ] Audio pronunciation
- [ ] Image context (screenshots)
- [ ] Spaced repetition reminders
- [ ] Collaborative flashcard collections
- [ ] Import/export functionality
- [ ] Usage analytics and progress tracking

## Credits

Built with ❤️ for language learners everywhere.

## Additional Resources

- [Browser Extension Best Practices](../BROWSER_EXTENSION_BEST_PRACTICES.md)
- [Extension Architecture](../EXTENSION_ARCHITECTURE.md)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Firefox Extension Documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
