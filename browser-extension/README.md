# ScribeCat Canvas Course Collector

A browser extension that collects course information from Canvas Instructure dashboards for use with the ScribeCat desktop application.

## Features

- **Privacy-Focused**: Only accesses Canvas domains, stores data locally
- **Cross-Browser**: Works with Chrome and Firefox (Manifest V3)
- **Smart Parsing**: Automatically detects course numbers and titles from various Canvas layouts
- **Institution Support**: Works with different Canvas instances (UD, other universities)
- **Export Options**: JSON and CSV export formats
- **ScribeCat Integration**: Direct import into ScribeCat desktop app

## Installation

### Chrome

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `browser-extension` folder
5. The extension will appear in your extensions toolbar

### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" in the sidebar
4. Click "Load Temporary Add-on"
5. Navigate to the `browser-extension` folder and select `manifest.json`
6. The extension will be loaded temporarily

## Usage

### Basic Workflow

1. **Navigate to Canvas**: Go to your institution's Canvas dashboard (e.g., canvas.udel.edu)
2. **Open Extension**: Click the ScribeCat extension icon in your browser toolbar
3. **Collect Courses**: Click "Collect Courses" to scan for enrolled courses
4. **Review Results**: Check that courses were detected correctly
5. **Export Data**: Use "Copy for ScribeCat" to copy data for import
6. **Import to ScribeCat**: Paste the data into ScribeCat's course import feature

### Detailed Steps

#### Step 1: Access Canvas Dashboard
- Navigate to your Canvas dashboard (usually the main page after logging in)
- Ensure you're on a page that shows your enrolled courses
- The extension works best on the main dashboard view

#### Step 2: Collect Course Data
- Click the ScribeCat extension icon
- Click "Collect Courses" button
- Wait for the collection to complete
- Review the list of detected courses

#### Step 3: Export for ScribeCat
- Click "Copy for ScribeCat" button
- A modal will open with JSON data
- Click "Copy to Clipboard" to copy the data
- Close the modal

#### Step 4: Import to ScribeCat
- Open ScribeCat desktop application
- Go to Settings > Canvas Integration
- Click "Import from Extension"
- Paste the copied JSON data
- Click "Import Courses"

## Supported Canvas Layouts

The extension includes selectors for various Canvas dashboard layouts:

- **Standard Canvas**: Modern dashboard cards
- **University of Delaware**: UD-specific layout
- **Legacy Canvas**: Older Canvas themes
- **Custom Themes**: Institution-specific customizations

## Data Format

The extension exports data in the following format:

```json
{
  "source": "ScribeCat Canvas Browser Extension",
  "format": "scribecat_course_import_v1",
  "version": "1.1.0",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "canvasUrl": "https://canvas.udel.edu",
  "institution": "udel",
  "collected": "2024-01-15T10:30:00.000Z",
  "courses": [
    {
      "id": "course_12345",
      "canvasId": "12345",
      "courseNumber": "CISC108",
      "courseTitle": "Introduction to Computer Science",
      "collected": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

## Troubleshooting

### No Courses Detected

1. **Check Canvas Layout**: Ensure you're on the main dashboard page
2. **Refresh Page**: Try refreshing the Canvas page and collecting again
3. **Test Selectors**: Use the debug tools (if available) to test selectors
4. **Check Console**: Open browser developer tools to see any error messages

### Extension Not Working

1. **Check Permissions**: Ensure the extension has permission to access Canvas
2. **Reload Extension**: Try disabling and re-enabling the extension
3. **Update Extension**: Make sure you have the latest version
4. **Browser Compatibility**: Ensure you're using a supported browser version

### Import Issues in ScribeCat

1. **Valid JSON**: Ensure the copied data is valid JSON
2. **Correct Format**: Use the "Copy for ScribeCat" button, not raw export
3. **ScribeCat Version**: Ensure ScribeCat is up to date
4. **Data Size**: Very large course lists might need to be imported in batches

## Privacy Policy

- **Data Collection**: Only collects course numbers and titles visible on your dashboard
- **Data Storage**: All data is stored locally in your browser
- **No External Servers**: No data is sent to external servers
- **Canvas Only**: Only accesses Canvas Instructure domains
- **User Control**: You can clear all stored data at any time

## Development

### Building from Source

1. Clone the repository
2. Navigate to the `browser-extension` directory
3. No build process required - the extension runs directly from source

### Testing

1. Load the extension in developer mode
2. Navigate to a Canvas dashboard
3. Test course collection functionality
4. Verify data export formats

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review the browser console for error messages
3. Create an issue in the repository
4. Contact the ScribeCat development team

## Version History

### v1.1.0
- Enhanced data format with institution and Canvas URL
- Improved course parsing with UD-specific selectors
- Added debug tools for selector testing
- UI improvements with last collection timestamp
- Better error handling and user feedback

### v1.0.0
- Initial release
- Basic course collection functionality
- JSON and CSV export options
- ScribeCat integration support

## License

This extension is part of the ScribeCat project. See the main repository for license information.