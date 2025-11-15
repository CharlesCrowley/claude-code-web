/**
 * Selection Handler
 * Handles text selection, context extraction, and highlighting
 */

export class SelectionHandler {
  constructor() {
    this.selectionRange = null;
    this.selectedText = '';
  }

  /**
   * Get selected text with metadata
   * @returns {Object|null} Selection data or null
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
   * @returns {string} Context sentence
   */
  getContext() {
    if (!this.selectionRange) return '';

    try {
      const range = this.selectionRange.cloneRange();
      const container = range.commonAncestorContainer;

      // Get text content from container
      let textContent = '';

      if (container.nodeType === Node.TEXT_NODE) {
        textContent = container.textContent || '';
      } else {
        textContent = container.textContent || '';
      }

      if (!textContent) return this.selectedText;

      const selectedPosition = range.startOffset;

      // Find sentence boundaries
      const sentenceBoundaries = ['.', '!', '?', '\n', '。', '！', '？'];

      let start = 0;
      let end = textContent.length;

      // Find start of sentence (look backwards)
      for (let i = selectedPosition - 1; i >= 0; i--) {
        if (sentenceBoundaries.includes(textContent[i])) {
          start = i + 1;
          break;
        }
      }

      // Find end of sentence (look forwards)
      for (let i = selectedPosition; i < textContent.length; i++) {
        if (sentenceBoundaries.includes(textContent[i])) {
          end = i + 1;
          break;
        }
      }

      const context = textContent.substring(start, end).trim();
      return context || this.selectedText;
    } catch (error) {
      console.error('Error extracting context:', error);
      return this.selectedText;
    }
  }

  /**
   * Get position for highlighting restoration
   * @returns {Object|null} Position data
   */
  getPosition() {
    if (!this.selectionRange) return null;

    try {
      const rect = this.selectionRange.getBoundingClientRect();

      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
      };
    } catch (error) {
      console.error('Error getting position:', error);
      return null;
    }
  }

  /**
   * Get page metadata
   * @returns {Object} Page metadata
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
   * @param {string} color - Highlight color
   * @param {boolean} persist - Whether to persist highlight
   * @returns {string|null} Highlight ID or null
   */
  highlightSelection(color = '#FFEB3B', persist = false) {
    if (!this.selectionRange) return null;

    try {
      const span = document.createElement('span');
      span.className = 'flashcard-highlight';
      span.style.backgroundColor = color;
      span.style.borderRadius = '2px';
      span.style.padding = '2px 0';
      span.dataset.flashcardId = Date.now().toString();

      // Clone range to avoid modifying original
      const range = this.selectionRange.cloneRange();

      // Surround selection with highlight span
      range.surroundContents(span);

      const highlightId = span.dataset.flashcardId;

      if (persist) {
        this.saveHighlight(span);
      }

      return highlightId;
    } catch (error) {
      console.error('Failed to highlight selection:', error);
      return null;
    }
  }

  /**
   * Save highlight for persistence
   * @param {HTMLElement} highlightElement - Highlight element
   * @returns {Promise<void>}
   */
  async saveHighlight(highlightElement) {
    try {
      const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

      const data = {
        id: highlightElement.dataset.flashcardId,
        text: this.selectedText,
        url: window.location.href,
        xpath: this.getXPath(highlightElement)
      };

      const result = await browserAPI.storage.local.get('highlights');
      const highlights = result.highlights || [];
      highlights.push(data);

      await browserAPI.storage.local.set({ highlights });
    } catch (error) {
      console.error('Failed to save highlight:', error);
    }
  }

  /**
   * Get XPath for element (for persistence)
   * @param {HTMLElement} element - Element
   * @returns {string} XPath
   */
  getXPath(element) {
    if (!element) return '';

    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    if (element === document.body) {
      return '/html/body';
    }

    let ix = 0;
    const siblings = element.parentNode?.childNodes || [];

    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];

      if (sibling === element) {
        const parentPath = this.getXPath(element.parentNode);
        const tagName = element.tagName?.toLowerCase() || 'unknown';
        return `${parentPath}/${tagName}[${ix + 1}]`;
      }

      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }

    return '';
  }

  /**
   * Restore highlights on page load
   * @returns {Promise<void>}
   */
  static async restoreHighlights() {
    try {
      const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
      const result = await browserAPI.storage.local.get('highlights');
      const highlights = result.highlights || [];
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
    } catch (error) {
      console.error('Failed to restore highlights:', error);
    }
  }

  /**
   * Clear selection
   * @returns {void}
   */
  clearSelection() {
    this.selectionRange = null;
    this.selectedText = '';
  }
}
