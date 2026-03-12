/**
 * Convert SVG icons to PNG using Sharp
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'assets', 'icons');

async function convertIcons() {
    console.log('Converting SVG to PNG...');

    for (const size of sizes) {
        const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
        const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);

        try {
            await sharp(svgPath)
                .resize(size, size)
                .png()
                .toFile(pngPath);
            console.log(`  Converted: icon-${size}x${size}.png`);
        } catch (err) {
            console.error(`  Error converting ${size}x${size}: ${err.message}`);
        }
    }

    // Create favicon.ico from 32x32 SVG
    const faviconSvg = path.join(__dirname, '..', 'public', 'favicon.svg');
    const faviconPng = path.join(__dirname, '..', 'public', 'favicon.png');
    const faviconIco = path.join(__dirname, '..', 'public', 'favicon.ico');

    try {
        // Create 32x32 PNG for favicon
        await sharp(faviconSvg)
            .resize(32, 32)
            .png()
            .toFile(faviconPng);
        console.log('  Created: favicon.png');

        // For ICO, we'll just copy PNG as browsers accept it
        // True ICO would need another library
        fs.copyFileSync(faviconPng, faviconIco);
        console.log('  Created: favicon.ico (PNG format)');
    } catch (err) {
        console.error(`  Error creating favicon: ${err.message}`);
    }

    console.log('\nDone! PNG icons created.');
}

convertIcons().catch(console.error);
