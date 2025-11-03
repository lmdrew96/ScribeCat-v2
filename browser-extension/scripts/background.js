// Background script for ScribeCat Canvas Course Collector

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('ScribeCat Canvas Course Collector installed:', details.reason);
  
  // Set default settings
  chrome.storage.local.set({
    'scribecat_settings': {
      autoCollect: true,
      exportFormat: 'json',
      domainWhitelist: ['*.instructure.com'],
      lastUpdated: new Date().toISOString()
    }
  });
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openScribeCat') {
    handleOpenScribeCat()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Attempt to communicate with ScribeCat desktop app
async function handleOpenScribeCat() {
  try {
    // Since we can't directly communicate with the Electron app,
    // we'll copy the data to clipboard for manual import
    const result = await chrome.storage.local.get(['scribecat_courses']);
    const courses = result.scribecat_courses || [];
    
    if (courses.length === 0) {
      return { success: false, error: 'No courses collected yet' };
    }
    
    // Create import data for ScribeCat
    const importData = {
      source: 'Canvas Browser Extension',
      format: 'scribecat_import',
      timestamp: new Date().toISOString(),
      courses: courses.map(course => ({
        id: course.id,
        courseNumber: course.courseNumber,
        courseTitle: course.courseTitle
      }))
    };
    
    // Copy to clipboard using the newer Clipboard API
    const dataString = JSON.stringify(importData, null, 2);
    
    // We can't directly access clipboard from background script,
    // so we'll return the data for the popup to handle
    return { 
      success: true, 
      message: 'Course data ready for import',
      data: dataString,
      instructions: 'Copy this data and import it in ScribeCat'
    };
  } catch (error) {
    console.error('Failed to prepare ScribeCat data:', error);
    return { success: false, error: error.message };
  }
}

// Badge text to show course count
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.scribecat_courses) {
    const courses = changes.scribecat_courses.newValue || [];
    const count = courses.length;
    
    chrome.action.setBadgeText({
      text: count > 0 ? count.toString() : ''
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: '#4CAF50'
    });
  }
});

console.log('ScribeCat Canvas Course Collector background script loaded');