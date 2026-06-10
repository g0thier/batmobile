import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const inputIcon = 'raw-assets/icon.png';
const outputDir = 'public/icons';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

await mkdir(outputDir, { recursive: true });

for (const size of sizes) {
  const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

  await sharp(inputIcon)
    .resize(size, size, {
      fit: 'cover',
      position: 'center',
    })
    .png()
    .toFile(outputPath);

  console.log(`✅ ${outputPath}`);
}