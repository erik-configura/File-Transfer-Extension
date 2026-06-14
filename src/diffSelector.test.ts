import * as fs from 'fs';
import * as path from 'path';
import { computeDiffCandidates, computeDiffFlags } from './diffSelector';

const tmp = path.join(__dirname, '..', 'tmp-diffsel-test');
const src = path.join(tmp, 'source');
const dest = path.join(tmp, 'dest');

beforeAll(async () => {
  await fs.promises.rm(tmp, { recursive: true, force: true });
  await fs.promises.mkdir(src, { recursive: true });
  await fs.promises.mkdir(dest, { recursive: true });
});

afterAll(async () => {
  await fs.promises.rm(tmp, { recursive: true, force: true });
});

afterEach(async () => {
  await fs.promises.rm(src, { recursive: true, force: true });
  await fs.promises.rm(dest, { recursive: true, force: true });
  await fs.promises.mkdir(src, { recursive: true });
  await fs.promises.mkdir(dest, { recursive: true });
});

test('finds multiple changed files using metadata', async () => {
  const aSrc = path.join(src, 'a.txt');
  const bSrc = path.join(src, 'b.txt');
  const aDest = path.join(dest, 'a.txt');
  const bDest = path.join(dest, 'b.txt');

  await fs.promises.writeFile(aSrc, 'one');
  await fs.promises.writeFile(bSrc, 'one');
  await fs.promises.writeFile(aDest, 'two');
  await fs.promises.writeFile(bDest, 'one');

  const destFiles = [
    { name: 'a.txt', path: aDest },
    { name: 'b.txt', path: bDest }
  ];

  const metadata: Record<string, string> = {
    'a.txt': aSrc,
    'b.txt': bSrc
  };

  const candidates = await computeDiffCandidates(destFiles, metadata);
  const names = candidates.map(c => c.name).sort();

  expect(names).toEqual(['a.txt']);
  expect(candidates.length).toBe(1);
});

test('builds diff flags for changed destination files', async () => {
  const aSrc = path.join(src, 'a.txt');
  const bSrc = path.join(src, 'b.txt');
  const aDest = path.join(dest, 'a.txt');
  const bDest = path.join(dest, 'b.txt');

  await fs.promises.writeFile(aSrc, 'one');
  await fs.promises.writeFile(bSrc, 'one');
  await fs.promises.writeFile(aDest, 'two');
  await fs.promises.writeFile(bDest, 'one');

  const destFiles = [
    { name: 'a.txt', path: aDest },
    { name: 'b.txt', path: bDest }
  ];

  const metadata: Record<string, string> = {
    'a.txt': aSrc,
    'b.txt': bSrc
  };

  const flags = await computeDiffFlags(destFiles, metadata);

  expect(flags).toEqual({ 'a.txt': true });
});

test('returns empty flags for unchanged files', async () => {
  const aSrc = path.join(src, 'a.txt');
  const aDest = path.join(dest, 'a.txt');

  await fs.promises.writeFile(aSrc, 'same-content');
  await fs.promises.writeFile(aDest, 'same-content');

  const destFiles = [{ name: 'a.txt', path: aDest }];
  const metadata: Record<string, string> = { 'a.txt': aSrc };

  const flags = await computeDiffFlags(destFiles, metadata);

  expect(flags).toEqual({});
});

test('ignores files not present in metadata', async () => {
  const orphanDest = path.join(dest, 'orphan.txt');
  await fs.promises.writeFile(orphanDest, 'content');

  const flags = await computeDiffFlags([{ name: 'orphan.txt', path: orphanDest }], {});

  expect(flags).toEqual({});
});

test('ignores entries when referenced source file does not exist', async () => {
  const missingSrc = path.join(src, 'missing.txt');
  const destFile = path.join(dest, 'missing.txt');

  await fs.promises.writeFile(destFile, 'dest-content');

  const flags = await computeDiffFlags(
    [{ name: 'missing.txt', path: destFile }],
    { 'missing.txt': missingSrc }
  );

  expect(flags).toEqual({});
});
