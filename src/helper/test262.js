'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '../../');
const test262Dir = path.join(projectRoot, 'test262');
const builtinsDir = path.join(test262Dir, 'test', 'built-ins');
const closureRuntimeDir = path.join(
  projectRoot,
  'closure-compiler/src/com/google/javascript/jscomp/js'
);

const harnessAssert = readTest262Harness('assert.js');
const harnessSta = readTest262Harness('sta.js');

/**
 * @param {string} target like 'Map' or 'Array.prototype.copyWithin'
 * @param {string=} targetTestDir Test262 test direcotry for the target
 * @param {string=} targetPolyfillPath
 */
function builtins(
  target,
  targetTestDir = path.join(builtinsDir, ...target.split('.')),
  targetPolyfillPath
) {
  describe(path.basename(targetTestDir), () => {
    let files;
    try {
      files = fs.readdirSync(targetTestDir).map(item => {
        const abs = path.join(targetTestDir, item);
        return {name: item, abs, stat: fs.statSync(abs)};
      });
    } catch (e) {
      const targetTestFile = `${targetTestDir}.js`;
      const stat = fs.statSync(targetTestFile);
      if (!stat.isFile()) {
        throw e;
      }
      files = [
        {
          name: path.basename(targetTestFile),
          abs: targetTestFile,
          stat,
        },
      ];
    }

    files
      .sort((a, b) => {
        const aIsDir = Number(a.stat.isDirectory());
        const bIsDir = Number(b.stat.isDirectory());
        if (aIsDir < bIsDir) {
          return -1;
        } else if (aIsDir > bIsDir) {
          return 1;
        }

        if (a.name < b.name) {
          return -1;
        } else if (a.name > b.name) {
          return 1;
        }

        return 0;
      })
      .forEach(({name, abs, stat}) => {
        if (stat.isDirectory()) {
          builtins(target, abs, targetPolyfillPath);
        } else if (process.env.SKIP_NAME && name === 'name.js') {
          it.skip('name');
        } else if (process.env.SKIP_LENGTH && name === 'length.js') {
          it.skip('length');
        } else {
          it(name.replace(/\.js$/, '').replace(/-/g, ' '), () => {
            runBuiltinTest(target, abs, targetPolyfillPath);
          });
        }
      });
  });
}

/**
 * @param {string} harness file name in 'test262/harsess' like 'assert.js'
 * @return {string}
 */
function readTest262Harness(harness) {
  return fs.readFileSync(path.join(test262Dir, 'harness', harness), 'utf8');
}

/**
 * @param {string} polyfillFile relative path from src/com/google/javascript/jscomp/js like 'es6/array/fill.js'
 * @return {string}
 */
function readClosureRuntime(polyfillFile) {
  // expm1 is correct.
  // https://github.com/google/closure-compiler/pull/2903
  const fixedPath = polyfillFile.replace(/expm1/, 'exp1m');
  return fs.readFileSync(path.join(closureRuntimeDir, fixedPath), 'utf8');
}

/**
 * @param {string} polyfillPath relative path from src/com/google/javascript/jscomp/js w/o ext like 'es6/array/fill'
 * @param {Array<string>=} polyfills
 * @param {Map<string, string>=} cache
 * @return {Array<string>}
 */
function loadPolyfill(polyfillPath, polyfills = [], cache = new Map()) {
  let polyfill = cache.get(polyfillPath);
  if (!polyfill) {
    polyfill = readClosureRuntime(`${polyfillPath}.js`);
    cache.set(polyfillPath, polyfill);
  }
  const regex = /^'require (.*)'/gm;
  let match;
  while ((match = regex.exec(polyfill)) !== null) {
    const [, required] = match;
    if (!cache.has(required)) {
      loadPolyfill(required, polyfills, cache);
    }
  }
  polyfills.push(polyfill);
  return polyfills;
}

/**
 * @param {string} testPath
 * @return {Array<string>}
 */
function loadTest(testPath) {
  const src = [];
  const testSrc = fs.readFileSync(testPath, 'utf8');
  let match = /^flags: \[(.*)\]/m.exec(testSrc);
  if (match) {
    const flags = match[1].split(',').map(flag => flag.trim());
    if (flags.includes('async')) {
      src.push(readTest262Harness('doneprintHandle.js'));
    }
  }

  match = /^includes: \[(.*)\]/m.exec(testSrc);
  if (match) {
    const includes = match[1].split(',').map(include => include.trim());
    includes.forEach(include => {
      src.push(readTest262Harness(include));
    });
  }
  src.push(testSrc);
  return src;
}

/**
 * @param {string} target
 * @param {string} testPath
 * @param {string=} targetPolyfillPath
 */
function runBuiltinTest(target, testPath, targetPolyfillPath) {
  if (!targetPolyfillPath) {
    targetPolyfillPath = path.join(
      'es6',
      ...target
        .split('.')
        .filter(item => item !== 'prototype')
        .map(item => item.toLowerCase())
    );
  }
  const polyfills = loadPolyfill(targetPolyfillPath);
  const testSrcList = loadTest(testPath);
  const src = [`this.${target} = null;`, ...polyfills, harnessAssert, harnessSta, ...testSrcList];
  vm.runInNewContext(
    src.join(';\n'),
    {
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      console,
      print(str) {
        if (str !== 'Test262:AsyncTestComplete') {
          throw new Error(str);
        }
      },
    },
    {timeout: 1000}
  );
}

module.exports = {builtins};
