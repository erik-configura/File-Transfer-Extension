import * as path from 'path';
import * as fs from 'fs';
import * as metadata from './metadataManager';

const tmp = path.join(__dirname, '..', 'tmp-metadata-test');
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

describe('metadataManager', () => {
  test('saves and loads metadata correctly', async () => {
    const data = { 'one.txt': 'source/one.txt', 'two.txt': 'source/two.txt' };
    await metadata.saveMetadata(destDir, data);

    const loaded = await metadata.loadMetadata(destDir);
    expect(loaded).toEqual(data);
  });

  test('updateMetadata preserves existing entries and adds new ones', async () => {
    await metadata.saveMetadata(destDir, { 'one.txt': 'source/one.txt' });
    await metadata.updateMetadata(destDir, 'two.txt', 'source/two.txt');

    const loaded = await metadata.loadMetadata(destDir);
    expect(loaded).toEqual({ 'one.txt': 'source/one.txt', 'two.txt': 'source/two.txt' });
  });

  test('removeMetadataEntry removes only the requested entry', async () => {
    await metadata.saveMetadata(destDir, { 'one.txt': 'source/one.txt', 'two.txt': 'source/two.txt' });
    await metadata.removeMetadataEntry(destDir, 'one.txt');

    const loaded = await metadata.loadMetadata(destDir);
    expect(loaded).toEqual({ 'two.txt': 'source/two.txt' });
  });
});
