# mini-ignore-match

Match paths against gitignore-style patterns and apply last-match-wins precedence.

```js
import { compile, match, filter } from './src/index.js';

const isIgnored = compile(['*.log', '!important.log', 'build/']);

isIgnored('debug.log');          // true
isIgnored('important.log');      // false
isIgnored('build', true);        // true
isIgnored('src/app.js');         // false

match('dist/bundle.js', 'dist/'); // false — dist is a directory pattern
match('dist', 'dist/', true);     // true

filter(['src/a.js', 'src/a.test.js', 'dist/a.js'], ['*.test.js', 'dist/']);
// ['src/a.js']
```

## Why this exists

Git's ignore rules are simple to describe and fiddly to implement. The two
behaviours that trip people up are that a pattern without a slash matches at
any depth, and that the last matching rule wins. A naive implementation that
returns on the first match gets both wrong. This library keeps the whole rule
list and walks it in order, so precedence falls out naturally.

The trade-off is that matching is linear in the number of rules. For the
sizes of ignore files people actually write this is not worth optimising, and
keeping the rules ordered is what makes `!` re-inclusion work.

## The awkward edge

A pattern ending in `/` matches directories only. The matcher therefore needs
to know whether the path it is given is a directory, which a plain string
cannot tell it. Pass `true` as the second argument to the compiled function,
or a predicate as the third argument to `filter`. If you call the matcher
without that flag, directory-only patterns will not match, and that is the
behaviour the tests pin down.

## API

`compile(...sources)` returns `isIgnored(path, isDir = false)`. Each source is
a string or an array of strings; arrays are treated as one pattern per line.

`match(path, patterns, isDir = false)` compiles `patterns` and tests one path.

`filter(paths, patterns, isDir = false)` returns the paths that are not
ignored. `isDir` may be a boolean or a function from path to boolean.
