import * as path from 'path';
import * as fs from 'fs';

const METADATA_FILENAME = '.ft-metadata.json';

export async function loadMetadata(folderPath: string): Promise<Record<string, string>> {
  const mf = path.join(folderPath, METADATA_FILENAME);
  try {
    const raw = await fs.promises.readFile(mf, { encoding: 'utf8' });
    const obj = JSON.parse(raw);
    console.log(`[FT] Loaded metadata from ${mf}:`, obj);
    return obj;
  } catch (e) {
    console.log(`[FT] Metadata file not found or error reading ${mf}`);
    return {};
  }
}

export async function saveMetadata(folderPath: string, data: Record<string, string>): Promise<void> {
  const mf = path.join(folderPath, METADATA_FILENAME);
  try {
    const raw = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(mf, raw, { encoding: 'utf8' });
    console.log(`[FT] Saved metadata to ${mf}:`, data);
  } catch (e) {
    console.error(`[FT] Error saving metadata to ${mf}:`, e);
  }
}

export async function updateMetadata(folderPath: string, destName: string, originalPath: string): Promise<void> {
  try {
    const md = await loadMetadata(folderPath);
    md[destName] = originalPath;
    await saveMetadata(folderPath, md);
    console.log(`[FT] Updated metadata: ${destName} => ${originalPath}`);
  } catch (e) {
    console.error(`[FT] Error updating metadata:`, e);
  }
}

export async function removeMetadataEntry(folderPath: string, destName: string): Promise<void> {
  try {
    const md = await loadMetadata(folderPath);
    if (md.hasOwnProperty(destName)) {
      delete md[destName];
      await saveMetadata(folderPath, md);
      console.log(`[FT] Removed metadata entry: ${destName}`);
    }
  } catch (e) {
    console.error(`[FT] Error removing metadata entry:`, e);
  }
}
