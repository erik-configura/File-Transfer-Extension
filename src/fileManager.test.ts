import * as fs from 'fs';
import * as path from 'path';
import { listDestinationFiles } from './fileManager';
import * as metadata from './metadataManager';

const tmp = path.join(__dirname, '..', 'tmp-filemanager-test');
const destDir = path.join(tmp, 'dest');

beforeAll(async () => {
  await fs.promises.rm(tmp, { recursive: true, force: true });
  await fs.promises.mkdir(destDir, { recursive: true });
});

afterAll(async () => {
  await fs.promises.rm(tmp, { recursive: true, force: true });
});

afterEach(async () => {
  await fs.promises.rm(destDir, { recursive: true, force: true });
  await fs.promises.mkdir(destDir, { recursive: true });
});

describe('fileManager', () => {
  test('listDestinationFiles returns only root files and excludes metadata file', async () => {
    const fileA = path.join(destDir, 'a.txt');
    const fileB = path.join(destDir, 'b.txt');
    const subDir = path.join(destDir, 'subdir');

    await fs.promises.writeFile(fileA, 'A');
    await fs.promises.writeFile(fileB, 'B');
    await fs.promises.mkdir(subDir, { recursive: true });
    await fs.promises.writeFile(path.join(subDir, 'nested.txt'), 'nested');
    await metadata.saveMetadata(destDir, { 'a.txt': '/source/a.txt' });

    const entries = await listDestinationFiles(destDir);
    const names = entries.map(entry => entry.name).sort();

    expect(names).toEqual(['a.txt', 'b.txt']);
    expect(entries.some(entry => entry.name === '.ft-metadata.json')).toBe(false);
    expect(entries.some(entry => entry.name === 'nested.txt')).toBe(false);
  });
});
