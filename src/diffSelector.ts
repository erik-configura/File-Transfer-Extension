import * as fs from 'fs';

export interface DiffCandidate {
  name: string;
  sourcePath: string;
  destPath: string;
}

export async function computeDiffCandidates(
  destFiles: Array<{ name: string; path: string }>,
  currentDestMetadata: Record<string, string>
): Promise<DiffCandidate[]> {
  const candidates: DiffCandidate[] = [];

  for (const destFile of destFiles) {
    const sourcePath = currentDestMetadata[destFile.name];
    if (!sourcePath) continue;

    try {
      const [sourceExists, destExists] = await Promise.all([
        fileExists(sourcePath),
        fileExists(destFile.path)
      ]);

      if (!sourceExists || !destExists) continue;

      const [sourceContent, destContent] = await Promise.all([
        fs.promises.readFile(sourcePath, 'utf8'),
        fs.promises.readFile(destFile.path, 'utf8')
      ]);

      if (sourceContent !== destContent) {
        candidates.push({ name: destFile.name, sourcePath, destPath: destFile.path });
      }
    } catch (e) {
      // ignore binary/read failures
      continue;
    }
  }

  return candidates;
}

export async function computeDiffFlags(
  destFiles: Array<{ name: string; path: string }>,
  currentDestMetadata: Record<string, string>
): Promise<Record<string, boolean>> {
  const flags: Record<string, boolean> = {};

  for (const destFile of destFiles) {
    const sourcePath = currentDestMetadata[destFile.name];
    if (!sourcePath) continue;

    try {
      const [sourceExists, destExists] = await Promise.all([
        fileExists(sourcePath),
        fileExists(destFile.path)
      ]);

      if (!sourceExists || !destExists) continue;

      const [sourceContent, destContent] = await Promise.all([
        fs.promises.readFile(sourcePath, 'utf8'),
        fs.promises.readFile(destFile.path, 'utf8')
      ]);

      if (sourceContent !== destContent) {
        flags[destFile.name] = true;
      }
    } catch (e) {
      // ignore binary/read failures
      continue;
    }
  }

  return flags;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}
