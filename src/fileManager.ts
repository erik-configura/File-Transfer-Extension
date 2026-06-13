import * as fs from 'fs';
import * as path from 'path';

const METADATA_FILENAME = '.ft-metadata.json';

export async function listFilesInFolder(folderPath: string): Promise<Array<{ name: string; path: string }>> {
  try {
    const files = await fs.promises.readdir(folderPath);
    const fileList: Array<{ name: string; path: string }> = [];

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.isFile()) {
        fileList.push({ name: file, path: filePath });
      }
    }

    return fileList.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error(`Error reading folder ${folderPath}:`, error);
    return [];
  }
}

export async function listDestinationFiles(folderPath: string): Promise<Array<{ name: string; path: string }>> {
  const files = await listFilesInFolder(folderPath);
  return files.filter(file => file.name !== METADATA_FILENAME);
}

export async function copyFile(sourcePath: string, destPath: string): Promise<void> {
  try {
    await fs.promises.copyFile(sourcePath, destPath, fs.constants.COPYFILE_FICLONE);
  } catch (error) {
    // Fallback to standard copy if FICLONE is not supported
    const content = await fs.promises.readFile(sourcePath);
    await fs.promises.writeFile(destPath, content);
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    throw new Error(`Failed to delete file ${filePath}: ${error}`);
  }
}

export async function moveFile(sourcePath: string, destPath: string): Promise<void> {
  try {
    await fs.promises.rename(sourcePath, destPath);
  } catch (error) {
    // If rename fails (cross-drive), copy and delete
    await copyFile(sourcePath, destPath);
    await deleteFile(sourcePath);
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listDirContents(folderPath: string): Promise<Array<{ name: string; path: string; isDirectory: boolean }>> {
  try {
    const entries = await fs.promises.readdir(folderPath);
    const results: Array<{ name: string; path: string; isDirectory: boolean }> = [];

    for (const entry of entries) {
      const entryPath = path.join(folderPath, entry);
      const stats = await fs.promises.stat(entryPath);
      results.push({ name: entry, path: entryPath, isDirectory: stats.isDirectory() });
    }

    results.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return results;
  } catch (error) {
    console.error(`Error listing directory ${folderPath}:`, error);
    return [];
  }
}

export async function listFilesRecursive(folderPath: string): Promise<Array<{ name: string; path: string; relativePath: string }>> {
  const results: Array<{ name: string; path: string; relativePath: string }> = [];

  async function walk(dir: string, base: string) {
    let entries: string[] = [];
    try {
      entries = await fs.promises.readdir(dir);
    } catch (e) {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(dir, entry);
      const stats = await fs.promises.stat(entryPath);
      if (stats.isDirectory()) {
        await walk(entryPath, base);
      } else if (stats.isFile()) {
        results.push({ name: entry, path: entryPath, relativePath: path.relative(base, entryPath) });
      }
    }
  }

  await walk(folderPath, folderPath);
  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

export async function copyFileToDir(sourcePath: string, destDir: string): Promise<string> {
  const parsed = path.parse(sourcePath);
  let destName = parsed.base;
  let destPath = path.join(destDir, destName);
  let count = 1;

  while (await fileExists(destPath)) {
    destName = `${parsed.name}-copy${count}${parsed.ext}`;
    destPath = path.join(destDir, destName);
    count++;
  }

  await copyFile(sourcePath, destPath);
  return destName;
}
