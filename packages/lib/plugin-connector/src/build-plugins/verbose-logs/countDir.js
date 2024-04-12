import fs from 'fs';
import path from 'path';

/**
 * Counts the number of directories in a given directory path.
 * @param {string} directoryPath - The path to the directory to be scanned.
 * @returns {Promise<number>} - The number of directories found in the given directory path.
 */
export async function countDirectories(directoryPath) {
  try {
    if (!fs.existsSync(directoryPath)) {
      console.log(`${directoryPath} does not exist.`);
      return 0;
    }
    const files = await fs.promises.readdir(directoryPath);
    let directoryCount = 0;

    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        directoryCount++;
      }
    }

    return directoryCount;
  } catch (err) {
    console.error('Error reading directory:', err);
    return 0;
  }
}