'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '../../');
const test262Dir = path.join(projectRoot, 'test262');
const closureRuntimeDir = path.join(
  projectRoot,
  'closure-compiler/src/com/google/javascript/jscomp/js'
);

const harnessAssert = readTest262Harness('assert.js');
const harnessSta = readTest262Harness('sta.js');

/**
 * @param {string} target like 'Array.prototype.copyWithin' or 'Array.from'
 */
function builtins(target) {
  const targetTestDir = path.join(
    test262Dir,
    'test',
    'built-ins',
    // expm1 is correct.
    // https://github.com/google/closure-compiler/pull/2903
    ...target.split('.').map(file => file.replace(/^exp1m$/, 'expm1'))
  );

  describe(target, () => {
    const files = fs.readdirSync(targetTestDir);
    files.sort().forEach(file => {
      it(path.basename(file, '.js').replace(/-/g, ' '), () => {
        runBuiltinTest(target, path.join(targetTestDir, file));
      });
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
  return fs.readFileSync(path.join(closureRuntimeDir, polyfillFile), 'utf8');
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
  const match = /^includes: \[(?:(?:, *)?([^,\]]*.js))+\]/m.exec(testSrc);
  if (match) {
    for (let i = 1; i < match.length; i++) {
      src.push(readTest262Harness(match[i]));
    }
  }
  src.push(testSrc);
  return src;
}

/**
 * @param {string} target
 * @param {string} testPath
 */
function runBuiltinTest(target, testPath) {
  const targetPolyfillPath = path.join(
    'es6',
    ...target
      .split('.')
      .filter(item => item !== 'prototype')
      .map(item => item.toLowerCase())
  );
  const polyfills = loadPolyfill(targetPolyfillPath);
  const testSrcList = loadTest(testPath);
  const src = [`${target} = null;`, ...polyfills, harnessAssert, harnessSta, ...testSrcList];
  vm.runInNewContext(src.join(';\n'), {console});
}

module.exports = {builtins};
