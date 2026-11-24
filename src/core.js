const REGEX_SPECIAL = /[|\\{}()[\]^$+?.]/g;
const GLOBSTAR = '\u0000';

function escapeRegex(str) {
  return str.replace(REGEX_SPECIAL, '\\$&');
}

/**
 * Translate one gitignore-style pattern into a RegExp.
 *
 * The pattern is normalised so that the returned regex can be matched
 * against a path relative to the ignore file's directory, using '/' as the
 * separator. A leading '/' anchors the pattern to the base.
 *
 * Why `**` is replaced by a sentinel before the normal `*` handling: a
 * single `*` must not cross directory separators, while `**` must. Doing
 * the replacement in one pass avoids the ordering bugs that come from
 * repeatedly rewriting the same string.
 */
function compilePattern(pattern) {
  let p = pattern;

  // A pattern that ends with a slash only matches directories. We keep the
  // information by appending a sentinel that the matcher interprets against
  // the `isDir` flag.
  let dirOnly = false;
  if (p.endsWith('/')) {
    dirOnly = true;
    p = p.slice(0, -1);
  }

  let anchored = false;
  if (p.startsWith('/')) {
    anchored = true;
    p = p.slice(1);
  }

  // A pattern without a slash (after stripping the leading one) matches in
  // every directory, as git does. We implement that by prefixing `(?:.*/)?`
  // unless the pattern is anchored. A pattern that already contains a slash
  // is relative to the base.
  const hasSlash = p.includes('/');
  const prefix = anchored || hasSlash ? '' : '(?:.*/)?';

  p = p.replace(/\*\*/g, GLOBSTAR);

  let out = '';
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === GLOBSTAR) {
      out += '.*';
    } else if (ch === '*') {
      out += '[^/]*';
    } else if (ch === '?') {
      out += '[^/]';
    } else {
      out += escapeRegex(ch);
    }
  }

  const regex = new RegExp('^' + prefix + out + '$');
  return { regex, dirOnly };
}

/**
 * Parse the textual content of a gitignore file into a list of rules.
 *
 * Blank lines and lines whose first non-space character is `#` are ignored.
 * A leading `!` negates the rule. A trailing space is significant in git's
 * grammar, so we only strip a single trailing unescaped space; we do not
 * attempt to implement backslash escaping of spaces, which is rare and would
 * make the parser much harder to reason about.
 */
function parsePatterns(text) {
  const rules = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine;
    if (line === '' || line.startsWith('#')) continue;
    // Trailing spaces are stripped by git unless escaped; we strip them all.
    line = line.replace(/\s+$/, '');
    if (line === '') continue;
    let negated = false;
    if (line.startsWith('!')) {
      negated = true;
      line = line.slice(1);
    }
    if (line === '') continue;
    const { regex, dirOnly } = compilePattern(line);
    rules.push({ regex, negated, dirOnly });
  }
  return rules;
}

/**
 * Build a matcher from one or more pattern sources.
 *
 * The returned function takes a path and an optional `isDir` flag and
 * returns true when the path should be ignored. Precedence follows git's
 * rule: the last matching pattern wins, so a later `!` can re-include a path
 * that an earlier pattern excluded.
 *
 * The `isDir` flag matters only for patterns that end with a slash. A
 * directory-only pattern never matches a file, and it matches a directory
 * regardless of whether that directory is itself ignored by an earlier rule.
 */
export function compile(...sources) {
  const rules = [];
  for (const source of sources) {
    if (typeof source === 'string') {
      rules.push(...parsePatterns(source));
    } else if (Array.isArray(source)) {
      for (const line of source) {
        if (typeof line !== 'string') {
          throw new TypeError('pattern lines must be strings');
        }
        rules.push(...parsePatterns(line));
      }
    } else {
      throw new TypeError('compile expects strings or arrays of strings');
    }
  }

  return function isIgnored(path, isDir = false) {
    if (typeof path !== 'string') {
      throw new TypeError('path must be a string');
    }
    // Normalise a leading './' and collapse duplicate slashes so callers can
    // pass either a relative path or one with a redundant prefix.
    let p = path.replace(/^\.\//, '').replace(/\/+/g, '/');
    if (p.startsWith('/')) p = p.slice(1);
    if (p === '') return false;

    let ignored = false;
    for (const rule of rules) {
      if (rule.dirOnly && !isDir) continue;
      if (rule.regex.test(p)) {
        ignored = !rule.negated;
      }
    }
    return ignored;
  };
}

/**
 * Convenience wrapper: compile the patterns once and test a single path.
 */
export function match(path, patterns, isDir = false) {
  return compile(patterns)(path, isDir);
}

/**
 * Return the subset of `paths` that is not ignored.
 *
 * `isDir` may be a boolean applied to every path, or a function that
 * receives the path and returns whether it is a directory. Passing a
 * function lets callers distinguish files from directories without
 * materialising a second array.
 */
export function filter(paths, patterns, isDir = false) {
  const isIgnored = compile(patterns);
  const dirPredicate = typeof isDir === 'function' ? isDir : () => isDir;
  const result = [];
  for (const path of paths) {
    if (!isIgnored(path, dirPredicate(path))) {
      result.push(path);
    }
  }
  return result;
}
