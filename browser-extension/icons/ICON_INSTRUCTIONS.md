# Icon Instructions

You need to create three icon sizes for the browser extension:
- `icon-16.png` (16x16 pixels)
- `icon-48.png` (48x48 pixels)
- `icon-128.png` (128x128 pixels)

## Design Suggestions

### Concept
A modern, clean icon representing flashcards and learning:
- Primary color: Purple gradient (#667eea to #764ba2)
- Symbol: A stylized flashcard with a bookmark or star
- Alternative: A book with a brain or lightbulb

### Tools to Create Icons

1. **Figma** (Free online)
   - Go to figma.com
   - Create a new file
   - Create artboards: 128x128, 48x48, 16x16
   - Export as PNG

2. **Canva** (Free online)
   - Go to canva.com
   - Use custom dimensions
   - Export as PNG

3. **GIMP** (Free desktop)
   - Create new image with required dimensions
   - Export as PNG

4. **Online Icon Generators**
   - https://www.favicon-generator.org/
   - https://realfavicongenerator.net/

## SVG Template

Here's an SVG template you can use as a starting point:

```svg
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background circle -->
  <circle cx="64" cy="64" r="60" fill="url(#grad)"/>

  <!-- Flashcard shape -->
  <rect x="32" y="40" width="64" height="48" rx="4" fill="white" opacity="0.9"/>

  <!-- Text lines (representing flashcard content) -->
  <rect x="40" y="52" width="48" height="4" rx="2" fill="url(#grad)" opacity="0.6"/>
  <rect x="40" y="60" width="40" height="4" rx="2" fill="url(#grad)" opacity="0.6"/>
  <rect x="40" y="68" width="44" height="4" rx="2" fill="url(#grad)" opacity="0.6"/>

  <!-- Bookmark accent -->
  <polygon points="90,40 90,64 82,58 74,64 74,40" fill="#FFEB3B"/>
</svg>
```

## Conversion Instructions

### From SVG to PNG

1. **Using Online Converter**:
   - Go to https://svgtopng.com/
   - Upload the SVG
   - Generate PNGs at 128x128, 48x48, and 16x16

2. **Using Inkscape** (Free desktop):
   - Open SVG in Inkscape
   - File → Export PNG Image
   - Set width/height to desired size
   - Export

3. **Using ImageMagick** (Command line):
   ```bash
   convert icon.svg -resize 128x128 icon-128.png
   convert icon.svg -resize 48x48 icon-48.png
   convert icon.svg -resize 16x16 icon-16.png
   ```

## Temporary Placeholder

For testing purposes, you can use emoji-based icons:
- Use a screenshot of the 📚 emoji at different sizes
- Or use https://twemoji.twitter.com/ to download the book emoji PNG

## Color Scheme

- Primary gradient: `#667eea` → `#764ba2`
- Accent yellow: `#FFEB3B`
- White: `#FFFFFF`
- Dark text: `#1a1a1a`

Once you have created the icons, place them in this directory:
- `browser-extension/icons/icon-16.png`
- `browser-extension/icons/icon-48.png`
- `browser-extension/icons/icon-128.png`
