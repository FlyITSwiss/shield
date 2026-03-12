/**
 * Generate PWA icons for Shield app
 * Creates shield-shaped icons in multiple sizes
 */

const fs = require('fs');
const path = require('path');

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Shield SVG template with lightning bolt
const createShieldSVG = (size) => {
    const scale = size / 100;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#9C27B0;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7B1FA2;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="boltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#E1BEE7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#CE93D8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Background circle -->
  <circle cx="50" cy="50" r="48" fill="#1A1A2E"/>
  <!-- Shield shape -->
  <path d="M50 12 L80 25 L80 50 C80 70 65 85 50 92 C35 85 20 70 20 50 L20 25 Z"
        fill="url(#shieldGrad)"
        stroke="#CE93D8"
        stroke-width="2"/>
  <!-- Lightning bolt -->
  <path d="M55 30 L45 52 L52 52 L45 70 L60 45 L52 45 Z"
        fill="url(#boltGrad)"/>
</svg>`;
};

// Output directory
const outputDir = path.join(__dirname, '..', 'public', 'assets', 'icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Generate SVG icons (browsers can use these directly)
console.log('Generating PWA icons...');

sizes.forEach(size => {
    const svg = createShieldSVG(size);
    const filename = `icon-${size}x${size}.svg`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, svg);
    console.log(`  Created: ${filename}`);
});

// Also create a simple PNG using base64 (fallback for older browsers)
// This creates a simple purple square with S for Shield
const createSimplePNG = (size) => {
    // We'll create SVG that can be converted by the browser
    return createShieldSVG(size);
};

// Create favicon SVG
const faviconSVG = createShieldSVG(32);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), faviconSVG);
console.log('  Created: favicon.svg');

// Create HTML to convert SVG to PNG (run in browser)
const converterHTML = `<!DOCTYPE html>
<html>
<head>
    <title>SVG to PNG Converter</title>
</head>
<body>
    <h1>Shield PWA Icon Generator</h1>
    <div id="output"></div>
    <script>
        const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
        const output = document.getElementById('output');

        sizes.forEach(size => {
            fetch('/assets/icons/icon-' + size + 'x' + size + '.svg')
                .then(r => r.text())
                .then(svg => {
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0, size, size);
                        const link = document.createElement('a');
                        link.download = 'icon-' + size + 'x' + size + '.png';
                        link.href = canvas.toDataURL('image/png');
                        link.textContent = 'Download ' + size + 'x' + size;
                        output.appendChild(link);
                        output.appendChild(document.createElement('br'));
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(svg);
                });
        });
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(outputDir, 'converter.html'), converterHTML);
console.log('  Created: converter.html (open in browser to generate PNGs)');

console.log('\\nDone! SVG icons created.');
console.log('Note: For PNG versions, open /assets/icons/converter.html in browser');
