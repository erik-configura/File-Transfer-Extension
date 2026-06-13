import * as fs from 'fs';
import * as path from 'path';
import { transferToDestination, transferToSource } from './transferHelper';
import * as metadata from './metadataManager';

const tmp = path.join(__dirname, '..', 'tmp-test');
const sourceDir = path.join(tmp, 'source');
const destDir = path.join(tmp, 'dest');

beforeAll(async () => {
  await fs.promises.rm(tmp, { recursive: true, force: true });
  await fs.promises.mkdir(sourceDir, { recursive: true });
  await fs.promises.mkdir(destDir, { recursive: true });
});

afterAll(async () => {
  await fs.promises.rm(tmp, { recursive: true, force: true });
});

afterEach(async () => {
  await fs.promises.rm(destDir, { recursive: true, force: true });
  await fs.promises.mkdir(destDir, { recursive: true });
  await metadata.saveMetadata(destDir, {});
});

describe('transferHelper', () => {
  test('transfers files to destination and updates metadata entry', async () => {
    const sourceFile = path.join(sourceDir, 'one.txt');
    await fs.promises.writeFile(sourceFile, 'hello');

    const result = await transferToDestination([{ name: 'one.txt', path: sourceFile }], destDir);
    const meta = await metadata.loadMetadata(destDir);
    const destFile = path.join(destDir, 'one.txt');

    expect(await fs.promises.readFile(destFile, 'utf8')).toBe('hello');
    expect(meta.one).toBeUndefined();
    expect(meta['one.txt']).toBe(sourceFile);
    expect(result['one.txt']).toBe(sourceFile);
  });

  test('keeps destination metadata entries when copying back to source', async () => {
    const sourceFile = path.join(sourceDir, 'two.txt');
    await fs.promises.writeFile(sourceFile, 'world');
    await transferToDestination([{ name: 'two.txt', path: sourceFile }], destDir);

    const destFile = path.join(destDir, 'two.txt');
    await transferToSource([{ name: 'two.txt', path: destFile }], destDir, sourceDir);

    const meta = await metadata.loadMetadata(destDir);
    expect(meta['two.txt']).toBe(sourceFile);
    expect(await fs.promises.readFile(path.join(sourceDir, 'two.txt'), 'utf8')).toBe('world');
  });

  test('copies destination file back to source even without metadata', async () => {
    const destFile = path.join(destDir, 'unknown.txt');
    await fs.promises.writeFile(destFile, 'missing');
    await metadata.saveMetadata(destDir, {});

    await transferToSource([{ name: 'unknown.txt', path: destFile }], destDir, sourceDir);
    expect(await fs.promises.readFile(path.join(sourceDir, 'unknown.txt'), 'utf8')).toBe('missing');
  });
});
