'use strict';

const test262 = require('./helper/test262');

test262.builtins('Number.isFinite');
test262.builtins('Number.isNaN');
test262.builtins('Number.isInteger');
test262.builtins('Number.isSafeInteger');
test262.builtins('Number.parseFloat');
test262.builtins('Number.parseInt');
test262.builtins('Number.EPSILON', undefined, 'es6/number/constants');
test262.builtins('Number.MAX_SAFE_INTEGER', undefined, 'es6/number/constants');
test262.builtins('Number.MIN_SAFE_INTEGER', undefined, 'es6/number/constants');
