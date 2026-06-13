import * as fs from 'fs';
import * as path from 'path';
import { computeDiffCandidates } from './diffSelector';

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
