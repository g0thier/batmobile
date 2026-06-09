// Librairie pour redimensionner et convertir les images
import sharp from 'sharp';

// Fonctions Node.js pour lire les dossiers et créer des dossiers
import { mkdir, readdir } from 'node:fs/promises';

// Utilitaire Node.js pour manipuler les chemins de fichiers
import path from 'node:path';

// Dossier source contenant les images originales
const inputRoot = 'raw-assets';

// Dossier de sortie utilisé par Angular
const outputRoot = 'public';

// Fonction récursive qui parcourt un dossier et tous ses sous-dossiers
async function processDir(dir) {
  // Lit le contenu du dossier courant
  // withFileTypes permet de savoir si chaque entrée est un fichier ou un dossier
  const entries = await readdir(dir, { withFileTypes: true });

  // Parcourt chaque fichier/dossier trouvé
  for (const entry of entries) {
    // Chemin complet vers le fichier ou dossier source
    const inputPath = path.join(dir, entry.name);

    // Chemin relatif depuis raw-assets/quiz
    // Exemple : covers/attentes.png
    const relativePath = path.relative(inputRoot, inputPath);

    // Si c'est un dossier, on le parcourt à son tour
    if (entry.isDirectory()) {
      await processDir(inputPath);
      continue;
    }

    // Ignore tous les fichiers qui ne sont pas des images
    if (!/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;

    // Analyse le chemin relatif :
    // parsed.dir  -> dossier relatif, ex: covers
    // parsed.name -> nom du fichier sans extension, ex: attentes
    const parsed = path.parse(relativePath);

    // Construit le chemin de sortie en gardant la même arborescence
    // Exemple :
    // raw-assets/quiz/covers/attentes.png
    // devient :
    // public/quiz/covers/attentes.webp
    const outputPath = path.join(
      outputRoot,
      parsed.dir,
      `${parsed.name}.webp`
    );

    // Crée le dossier de destination si nécessaire
    // recursive: true évite une erreur si le dossier existe déjà
    await mkdir(path.dirname(outputPath), { recursive: true });

    // Convertit l'image en WebP
    await sharp(inputPath)
      // Redimensionne à 640px max de largeur
      // withoutEnlargement évite d'agrandir une image plus petite
      .resize({ width: 640, withoutEnlargement: true })

      // Convertit en WebP avec une qualité de 80
      .webp({ quality: 80 })

      // Écrit le fichier généré
      .toFile(outputPath);

    // Affiche le fichier traité dans la console
    console.log(`✅ ${relativePath} -> ${path.relative(outputRoot, outputPath)}`);
  }
}

// Lance le traitement depuis raw-assets/quiz
await processDir(inputRoot);