'use strict';

const test262 = require('./helper/test262');

const list = [
  'Object.assign',
  'Object.entries',
  'Object.getOwnPropertyDescriptors',
  'Object.getOwnPropertySymbols',
  'Object.is',
  'Object.setPrototypeOf',
  'Object.values',
];
list.forEach(target => test262.builtins(target));
