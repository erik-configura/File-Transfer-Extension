import * as path from 'path';
import { copyFile, fileExists } from './fileManager';
import * as metadata from './metadataManager';

export async function transferToDestination(
  sourceFiles: Array<{ name: string; path: string }>,
  destFolderPath: string
): Promise<Record<string, string>> {
  const currentDestMetadata = await metadata.loadMetadata(destFolderPath);
  const updatedMetadata = { ...currentDestMetadata };

  for (const file of sourceFiles) {
    const destinationPath = path.join(destFolderPath, path.basename(file.path));
    await copyFile(file.path, destinationPath);
    updatedMetadata[path.basename(file.path)] = file.path;
  }

  await metadata.saveMetadata(destFolderPath, updatedMetadata);
  return updatedMetadata;
}

export async function transferToSource(
  destFiles: Array<{ name: string; path: string }>,
  destFolderPath: string,
  sourceFolderPath: string
): Promise<void> {
  const currentDestMetadata = await metadata.loadMetadata(destFolderPath);

  for (const file of destFiles) {
    const originalPath = currentDestMetadata[file.name] || path.join(sourceFolderPath, file.name);
    await copyFile(file.path, originalPath);
  }
}
