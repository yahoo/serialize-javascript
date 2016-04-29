/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Copyrights licensed under the New BSD License.
See the accompanying LICENSE file for terms.
*/

'use strict';

var isRegExp = require('util').isRegExp;

// Generate an internal UID to make the regexp pattern harder to guess.
var UID                 = Math.floor(Math.random() * 0x10000000000).toString(16);
var PLACE_HOLDER_REGEXP = new RegExp('"@__(FUNCTION|REGEXP|DATE)-' + UID + '-(\\d+)__@"', 'g');

var IS_NATIVE_CODE_REGEXP = /\{\s*\[native code\]\s*\}/g;
var UNSAFE_CHARS_REGEXP   = /[<>\/\u2028\u2029]/g;

// Mapping of unsafe HTML and invalid JavaScript line terminator chars to their
// Unicode char counterparts which are safe to use in JavaScript strings.
var UNICODE_CHARS = {
    '<'     : '\\u003C',
    '>'     : '\\u003E',
    '/'     : '\\u002F',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029'
};

// We can‘t just instanceof Date since dates are already converted to strings
// because of native Date.prototype.JSON (which use toISOString)
var DATE_LENGTH = new Date().toISOString().length
function isDate(d) {
  try {
    return (
      // testing length first to avoid new Date() for every string
      d.length === DATE_LENGTH &&
      d === ((new Date(d)).toISOString())
    )
  }
  // Invalid Date might throw "RangeError: invalid date" when calling toISOString
  catch(e) {}

  return false
}

module.exports = function serialize(obj, space) {
    var functions = [];
    var regexps   = [];
    var dates   = [];
    var str;

    // Creates a JSON string representation of the object and uses placeholders
    // for functions, regexps and dates (identified by index) which are later
    // replaced.
    str = JSON.stringify(obj, function (key, value) {
        if (typeof value === 'function') {
            return '@__FUNCTION-' + UID + '-' + (functions.push(value) - 1) + '__@';
        }

        if (typeof value === 'object' && isRegExp(value)) {
            return '@__REGEXP-' + UID + '-' + (regexps.push(value) - 1) + '__@';
        }

        if (typeof value === 'string' && isDate(value)) {
            return '@__DATE-' + UID + '-' + (dates.push(value) - 1) + '__@';
        }

        return value;
    }, space);

    // Protects against `JSON.stringify()` returning `undefined`, by serializing
    // to the literal string: "undefined".
    if (typeof str !== 'string') {
        return String(str);
    }

    // Replace unsafe HTML and invalid JavaScript line terminator chars with
    // their safe Unicode char counterpart. This _must_ happen before the
    // regexps and functions are serialized and added back to the string.
    str = str.replace(UNSAFE_CHARS_REGEXP, function (unsafeChar) {
        return UNICODE_CHARS[unsafeChar];
    });

    if (
      functions.length === 0 &&
      regexps.length === 0 &&
      dates.length === 0
    ) {
        return str;
    }

    // Replaces all occurrences of function, regexp and date placeholders in the
    // JSON string with their string representations.
    // If the original value can not be found, then `undefined` is used.
    return str.replace(PLACE_HOLDER_REGEXP, function (match, type, valueIndex) {
        if (type === 'DATE') {
            return "new Date(\"" + dates[valueIndex] + "\")";
        }

        if (type === 'REGEXP') {
            return regexps[valueIndex].toString();
        }

        var fn           = functions[valueIndex];
        var serializedFn = fn.toString();

        if (IS_NATIVE_CODE_REGEXP.test(serializedFn)) {
            throw new TypeError('Serializing native function: ' + fn.name);
        }

        return serializedFn;
    });
}
