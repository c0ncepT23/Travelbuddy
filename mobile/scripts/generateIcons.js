/**
 * Yori App Icon Generator
 * 
 * This script takes your Yori logo and generates all required app icon sizes
 * with the logo centered on a square canvas.
 * 
 * Usage:
 * 1. Place your Yori logo as "yori-logo.png" in the mobile/assets folder
 * 2. Run: node scripts/generateIcons.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const SOURCE_LOGO = path.join(ASSETS_DIR, 'yori-logo.png');

// Background color - light cream/off-white to match the logo's aesthetic
const BACKGROUND_COLOR = '#F8F8F6';

// Icon configurations
const ICONS = [
  { name: 'icon.png', size: 1024, logoPadding: 0.15 },           // 15% padding
  { name: 'adaptive-icon.png', size: 1024, logoPadding: 0.25 },  // 25% padding for Android safe zone
  { name: 'splash-icon.png', size: 512, logoPadding: 0.1 },      // Splash screen
  { name: 'favicon.png', size: 48, logoPadding: 0.1 },           // Web favicon
];

async function generateIcons() {
  // Check if source logo exists
  if (!fs.existsSync(SOURCE_LOGO)) {
    console.error('❌ Error: yori-logo.png not found in assets folder!');
    console.log('📁 Please place your Yori logo as: mobile/assets/yori-logo.png');
    process.exit(1);
  }

  console.log('🎨 Yori Icon Generator');
  console.log('======================\n');

  // Get source image dimensions
  const sourceMetadata = await sharp(SOURCE_LOGO).metadata();
  console.log(`📐 Source logo: ${sourceMetadata.width}x${sourceMetadata.height}px\n`);

  for (const icon of ICONS) {
    try {
      const { name, size, logoPadding } = icon;
      const outputPath = path.join(ASSETS_DIR, name);

      // Calculate logo size to fit within the square with padding
      const availableSpace = size * (1 - logoPadding * 2);
      
      // Scale logo to fit (maintain aspect ratio)
      const scale = availableSpace / sourceMetadata.width;
      const logoWidth = Math.round(sourceMetadata.width * scale);
      const logoHeight = Math.round(sourceMetadata.height * scale);

      // Resize the logo
      const resizedLogo = await sharp(SOURCE_LOGO)
        .resize(logoWidth, logoHeight, { fit: 'inside' })
        .toBuffer();

      // Create square canvas with centered logo
      const canvas = await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: BACKGROUND_COLOR,
        }
      })
      .composite([{
        input: resizedLogo,
        gravity: 'center',
      }])
      .png()
      .toFile(outputPath);

      console.log(`✅ Generated: ${name} (${size}x${size}px)`);
    } catch (error) {
      console.error(`❌ Failed to generate ${icon.name}:`, error.message);
    }
  }

  console.log('\n🎉 Done! All icons generated in mobile/assets/');
  console.log('\n💡 Next steps:');
  console.log('   1. Check the generated icons look good');
  console.log('   2. Rebuild your app: npx expo prebuild --clean');
}

generateIcons().catch(console.error);

