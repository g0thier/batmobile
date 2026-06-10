import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const inputIcon = 'raw-assets/icon.png';
const tempDir = 'public/tmp';
const outputIco = 'public/favicon.ico';

const sizes = [16, 32, 48, 64];

await mkdir(tempDir, { recursive: true });

const pngPaths = [];

try {
  for (const size of sizes) {
    const pngPath = path.join(tempDir, `favicon-${size}x${size}.png`);

    await sharp(inputIcon)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(pngPath);

    pngPaths.push(pngPath);
  }

  const icoBuffer = await pngToIco(pngPaths);
  await writeFile(outputIco, icoBuffer);

  console.log(`✅ ${outputIco}`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
  console.log(`🗑️ ${tempDir} supprimé`);
}