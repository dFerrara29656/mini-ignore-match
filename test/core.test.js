import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, match, filter } from '../src/index.js';

test('a plain pattern matches a file in any directory', () => {
  const ignored = compile('*.log');
  assert.equal(ignored('app.log'), true);
  assert.equal(ignored('logs/app.log'), true);
  assert.equal(ignored('app.txt'), false);
});

test('a leading slash anchors the pattern to the base', () => {
  const ignored = compile('/build');
  assert.equal(ignored('build'), true);
  assert.equal(ignored('src/build'), false);
});

test('a pattern containing a slash is relative to the base', () => {
  const ignored = compile('src/*.js');
  assert.equal(ignored('src/main.js'), true);
  assert.equal(ignored('lib/src/main.js'), false);
  assert.equal(ignored('src/deep/main.js'), false);
});

test('a single star does not cross a directory separator', () => {
  const ignored = compile('a/*/c');
  assert.equal(ignored('a/b/c'), true);
  assert.equal(ignored('a/b/d/c'), false);
});

test('a double star crosses directory separators', () => {
  const ignored = compile('a/**/c');
  assert.equal(ignored('a/b/c'), true);
  assert.equal(ignored('a/b/d/c'), true);
});

test('a trailing slash matches only directories', () => {
  const ignored = compile('cache/');
  assert.equal(ignored('cache', true), true);
  assert.equal(ignored('cache', false), false);
  assert.equal(ignored('src/cache', true), true);
});

test('a later negation re-includes a previously ignored path', () => {
  const ignored = compile(['*.log', '!important.log']);
  assert.equal(ignored('debug.log'), true);
  assert.equal(ignored('important.log'), false);
});

test('comments and blank lines are ignored', () => {
  const ignored = compile('# comment\n\n*.tmp\n');
  assert.equal(ignored('a.tmp'), true);
  assert.equal(ignored('a.txt'), false);
});

test('match compiles a single pattern set on the fly', () => {
  assert.equal(match('dist/bundle.js', 'dist/'), false);
  assert.equal(match('dist', 'dist/', true), true);
});

test('filter keeps only the paths that survive the rules', () => {
  const paths = ['src/a.js', 'src/a.test.js', 'dist/a.js', 'README.md'];
  const kept = filter(paths, ['*.test.js', 'dist/'], false);
  assert.deepEqual(kept, ['src/a.js', 'dist/a.js', 'README.md']);
});

test('filter accepts a directory predicate', () => {
  const paths = ['build', 'build/output.txt', 'src'];
  const kept = filter(paths, 'build/', (p) => p === 'build' || p === 'src');
  assert.deepEqual(kept, ['build/output.txt', 'src']);
});

test('a question mark matches exactly one non-separator character', () => {
  const ignored = compile('file?.txt');
  assert.equal(ignored('file1.txt'), true);
  assert.equal(ignored('file12.txt'), false);
  assert.equal(ignored('file/.txt'), false);
});

test('compile rejects non-string sources', () => {
  assert.throws(() => compile(42), TypeError);
  assert.throws(() => compile(['ok', 7]), TypeError);
});

test('the matcher rejects a non-string path', () => {
  const ignored = compile('*.log');
  assert.throws(() => ignored(123), TypeError);
});

test('a trailing space is stripped from a pattern', () => {
  const ignored = compile('foo   ');
  assert.equal(ignored('foo'), true);
});
