#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const files = ['../src/index.js', '../src/generated/runtime-validators.js'];
const source = Buffer.concat(await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url)))));
const bytes = source.length;
const gzipBytes = gzipSync(source).length;
const output = execFileSync('npm', ['pack', '--json', '--ignore-scripts'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
const report = JSON.parse(output)[0];
if (!report?.filename) throw new Error('npm pack did not report one package.');
const archive = path.join(root, report.filename);
const tarballBytes = fs.statSync(archive).size;
fs.rmSync(archive, { force: true });
const unpackedBytes = report.unpackedSize;
const ceilings = {
  bytes: 250_000,
  gzipBytes: 35_000,
  tarballBytes: 45_000,
  unpackedBytes: 290_000,
};

console.log(JSON.stringify({
  files: files.map((file) => file.slice(3)),
  bytes,
  gzipBytes,
  tarballBytes,
  unpackedBytes,
  ceilings,
}, null, 2));
if (bytes > ceilings.bytes
    || gzipBytes > ceilings.gzipBytes
    || tarballBytes > ceilings.tarballBytes
    || unpackedBytes > ceilings.unpackedBytes) {
  throw new Error('Browser runtime or actual npm tar exceeds the committed size ceiling.');
}
