const icongen = require('icon-gen');
const path = require('path');

async function generateWindowsIcon() {
  try {
    console.log('Generating Windows .ico file...');

    const inputPath = path.join(__dirname, '..', 'assets', 'nugget-logo-icon.png');
    const outputPath = path.join(__dirname, '..', 'build');

    const options = {
      type: 'ico',
      modes: ['ico'],
      names: {
        ico: 'icon'
      },
      sizes: [16, 24, 32, 48, 64, 128, 256]
    };

    const results = await icongen(inputPath, outputPath, options);

    console.log('✅ Windows .ico file created successfully at build/icon.ico');
    console.log('   Generated:', results);
  } catch (error) {
    console.error('❌ Error generating Windows icon:', error);
    process.exit(1);
  }
}

generateWindowsIcon();
