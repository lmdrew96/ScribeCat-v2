// Canvas Course Data Collector Content Script
// Scrapes course information from Canvas dashboard

class CanvasCourseCollector {
  constructor() {
    this.courses = [];
    this.selectors = {
      // Modern Canvas dashboard card selectors
      courseCards: [
        '.ic-DashboardCard',
        '.course-list-item',
        '[data-testid="DashboardCard"]',
        '.DashboardCard',
        // UD-specific selectors
        '.dashboard-card',
        '.course-card',
        '[class*="DashboardCard"]',
        '[class*="course-card"]'
      ],
      courseTitles: [
        '.ic-DashboardCard__header-title',
        '.course-name',
        '.ic-DashboardCard__header-title a',
        '[data-testid="DashboardCard__HeaderTitle"]',
        // UD-specific selectors
        '.course-title',
        '.dashboard-card-title',
        '[class*="title"] a',
        'h3 a',
        'h4 a'
      ],
      courseCodes: [
        '.ic-DashboardCard__header-subtitle',
        '.course-code',
        '.ic-DashboardCard__header-subtitle',
        '[data-testid="DashboardCard__HeaderSubtitle"]',
        // UD-specific selectors
        '.course-subtitle',
        '.course-code',
        '.dashboard-card-subtitle',
        '[class*="subtitle"]',
        '.course-info'
      ],
      courseLinks: [
        '.ic-DashboardCard__link',
        '.course-link',
        'a[href*="/courses/"]',
        // UD-specific selectors
        '.dashboard-card a',
        '.course-card a',
        'a[href*="course"]'
      ]
    };
  }

  // Wait for DOM elements to load
  waitForElements(selectors, timeout = 10000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkForElements = () => {
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            resolve(elements);
            return;
          }
        }
        
        if (Date.now() - startTime > timeout) {
          resolve([]);
          return;
        }
        
        setTimeout(checkForElements, 500);
      };
      
      checkForElements();
    });
  }

  // Extract course ID from Canvas URL
  extractCourseId(url) {
    const match = url.match(/\/courses\/(\d+)/);
    return match ? match[1] : null;
  }

  // Clean up course text (remove extra whitespace, etc.)
  cleanText(text) {
    return text ? text.trim().replace(/\s+/g, ' ') : '';
  }

  // Parse course code and title from combined text
  parseCourseInfo(titleElement, codeElement, linkElement) {
    let courseTitle = '';
    let courseCode = '';
    let courseId = '';

    // Extract title
    if (titleElement) {
      courseTitle = this.cleanText(titleElement.textContent);
    }

    // Extract course code
    if (codeElement) {
      courseCode = this.cleanText(codeElement.textContent);
    }

    // Extract course ID from link
    if (linkElement && linkElement.href) {
      courseId = this.extractCourseId(linkElement.href);
    }

    // Enhanced parsing strategies for different Canvas layouts
    if (!courseCode && courseTitle) {
      // Strategy 1: Standard format "CISC108 - Introduction to Computer Science"
      let match = courseTitle.match(/^([A-Z]{2,6}\s*\d{3,4}[A-Z]?)\s*[-–—]\s*(.+)$/i);
      if (match) {
        courseCode = match[1].trim();
        courseTitle = match[2].trim();
      } else {
        // Strategy 2: UD format "CISC 108: Introduction to Computer Science"
        match = courseTitle.match(/^([A-Z]{2,6}\s+\d{3,4}[A-Z]?)\s*:\s*(.+)$/i);
        if (match) {
          courseCode = match[1].trim();
          courseTitle = match[2].trim();
        } else {
          // Strategy 3: Look for course code at the beginning
          match = courseTitle.match(/^([A-Z]{2,6}\s*\d{3,4}[A-Z]?)\s+(.+)$/i);
          if (match) {
            courseCode = match[1].trim();
            courseTitle = match[2].trim();
          }
        }
      }
    }

    // If still no course code, try to extract from the card's parent or sibling elements
    if (!courseCode && titleElement) {
      const card = titleElement.closest('[class*="card"], [class*="DashboardCard"]');
      if (card) {
        // Look for course code in other elements within the card
        const codeSelectors = [
          '[class*="code"]',
          '[class*="subtitle"]',
          '[class*="info"]',
          'small',
          '.text-muted'
        ];
        
        for (const selector of codeSelectors) {
          const codeEl = card.querySelector(selector);
          if (codeEl && codeEl.textContent.trim()) {
            const text = this.cleanText(codeEl.textContent);
            // Check if it looks like a course code
            if (/^[A-Z]{2,6}\s*\d{3,4}[A-Z]?$/.test(text)) {
              courseCode = text;
              break;
            }
          }
        }
      }
    }

    return {
      id: courseId,
      courseNumber: courseCode,
      courseTitle: courseTitle,
      fullTitle: titleElement ? this.cleanText(titleElement.textContent) : ''
    };
  }

  // Main course collection method
  async collectCourses() {
    console.log('ScribeCat: Starting course collection from Canvas dashboard...');
    
    // Wait for course cards to load
    const courseCards = await this.waitForElements(this.selectors.courseCards);
    
    if (courseCards.length === 0) {
      console.log('ScribeCat: No course cards found on this page');
      return [];
    }

    console.log(`ScribeCat: Found ${courseCards.length} course cards`);
    this.courses = [];

    courseCards.forEach((card, index) => {
      try {
        // Find title element within this card
        let titleElement = null;
        for (const selector of this.selectors.courseTitles) {
          titleElement = card.querySelector(selector);
          if (titleElement) break;
        }

        // Find code element within this card
        let codeElement = null;
        for (const selector of this.selectors.courseCodes) {
          codeElement = card.querySelector(selector);
          if (codeElement) break;
        }

        // Find link element within this card
        let linkElement = null;
        for (const selector of this.selectors.courseLinks) {
          linkElement = card.querySelector(selector);
          if (linkElement) break;
        }

        // If no link in card, check if card itself is a link
        if (!linkElement && card.tagName === 'A') {
          linkElement = card;
        }

        const courseInfo = this.parseCourseInfo(titleElement, codeElement, linkElement);
        
        // Only add courses with at least a title
        if (courseInfo.courseTitle || courseInfo.fullTitle) {
          this.courses.push({
            id: courseInfo.id || `course_${index}`,
            courseNumber: courseInfo.courseNumber || '',
            courseTitle: courseInfo.courseTitle || courseInfo.fullTitle,
            canvasId: courseInfo.id,
            collected: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('ScribeCat: Error processing course card:', error);
      }
    });

    console.log(`ScribeCat: Collected ${this.courses.length} courses:`, this.courses);
    
    // Store courses in extension storage
    await chrome.storage.local.set({
      'scribecat_courses': this.courses,
      'scribecat_last_collection': new Date().toISOString(),
      'scribecat_canvas_url': window.location.origin
    });

    return this.courses;
  }

  // Get stored courses
  async getStoredCourses() {
    const result = await chrome.storage.local.get(['scribecat_courses']);
    return result.scribecat_courses || [];
  }

  // Check if current page is Canvas dashboard
  isCanvasDashboard() {
    const url = window.location.href;
    const path = window.location.pathname;
    
    // Check for Canvas domain
    if (!url.includes('instructure.com')) {
      return false;
    }
    
    // Check for dashboard-like paths
    const dashboardPatterns = [
      '/',
      '/dashboard',
      '/courses',
      ''
    ];
    
    return dashboardPatterns.some(pattern => 
      path === pattern || path.endsWith(pattern)
    );
  }

  // Test selectors for debugging
  async testSelectors() {
    console.log('ScribeCat: Testing selectors...');
    
    const results = {
      courseCards: [],
      workingSelectors: []
    };
    
    // Test course card selectors
    for (const selector of this.selectors.courseCards) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        results.courseCards = Array.from(elements);
        results.workingSelectors.push({
          type: 'courseCards',
          selector: selector,
          count: elements.length
        });
        break; // Use first working selector
      }
    }
    
    // Test other selectors within found cards
    if (results.courseCards.length > 0) {
      const card = results.courseCards[0]; // Test with first card
      
      // Test title selectors
      for (const selector of this.selectors.courseTitles) {
        const elements = card.querySelectorAll(selector);
        if (elements.length > 0) {
          results.workingSelectors.push({
            type: 'courseTitles',
            selector: selector,
            count: elements.length
          });
          break;
        }
      }
      
      // Test code selectors
      for (const selector of this.selectors.courseCodes) {
        const elements = card.querySelectorAll(selector);
        if (elements.length > 0) {
          results.workingSelectors.push({
            type: 'courseCodes',
            selector: selector,
            count: elements.length
          });
          break;
        }
      }
      
      // Test link selectors
      for (const selector of this.selectors.courseLinks) {
        const elements = card.querySelectorAll(selector);
        if (elements.length > 0) {
          results.workingSelectors.push({
            type: 'courseLinks',
            selector: selector,
            count: elements.length
          });
          break;
        }
      }
    }
    
    console.log('ScribeCat: Selector test results:', results);
    return results;
  }
}

// Initialize collector when page loads
const collector = new CanvasCourseCollector();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collectCourses') {
    collector.collectCourses()
      .then(courses => {
        sendResponse({ success: true, courses: courses });
      })
      .catch(error => {
        console.error('ScribeCat: Course collection failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getStoredCourses') {
    collector.getStoredCourses()
      .then(courses => {
        sendResponse({ success: true, courses: courses });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'checkDashboard') {
    sendResponse({ 
      success: true, 
      isDashboard: collector.isCanvasDashboard(),
      url: window.location.href 
    });
  }
  
  if (request.action === 'testSelectors') {
    collector.testSelectors()
      .then(results => {
        sendResponse({ success: true, results: results });
      })
      .catch(error => {
        console.error('ScribeCat: Selector test failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Auto-collect on dashboard pages when content script loads
if (collector.isCanvasDashboard()) {
  // Wait a bit for dynamic content to load
  setTimeout(() => {
    collector.collectCourses();
  }, 2000);
}

console.log('ScribeCat Canvas Course Collector content script loaded');