/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Copyrights licensed under the New BSD License.
See the accompanying LICENSE file for terms.
*/

'use strict';

var util = require('util');

module.exports = serialize;

var IS_NATIVE_CODE_REGEX = /\{\s*\[native code\]\s*\}/g,
    PLACE_HOLDER_REGEX   = /"@__(FUNCTION|REGEXP)_(\d+)__@"/g,
    UNSAFE_CHARS_REGEX   = /[<>\/\u2028\u2029]/g;

// Mapping of unsafe HTML and invalid JavaScript line terminator chars to their
// Unicode char counterparts which are safe to use in JavaScript strings.
var UNICODE_CHARS = {
    '<'     : '\\u003C',
    '>'     : '\\u003E',
    '/'     : '\\u002F',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029'
};

function serialize(obj) {
    var functions = [],
        regexps   = [],
        str;

    // Creates a JSON string representation of the object and uses placeholders
    // for functions and regexps (identified by index) which are later
    // replaced.
    str = JSON.stringify(obj, function (key, value) {
        if (typeof value === 'function') {
            return '@__FUNCTION_' + (functions.push(value) - 1) + '__@';
        }

        if (util.isRegExp(value)) {
            return '@__REGEXP_' + (regexps.push(value) - 1) + '__@';
        }

        return value;
    });

    // Protects against `JSON.stringify()` returning `undefined`, by serializing
    // to the literal string: "undefined".
    if (typeof str !== 'string') {
        return String(str);
    }

    // Replace unsafe HTML and invalid JavaScript line terminator chars with
    // their safe Unicode char counterpart. This _must_ happen before the
    // regexps and functions are serialized and added back to the string.
    str = str.replace(UNSAFE_CHARS_REGEX, function (unsafeChar) {
        return UNICODE_CHARS[unsafeChar];
    });

    if (!(functions.length || regexps.length)) {
        return str;
    }

    // Replaces all occurrences of function and regexp placeholders in the JSON
    // string with their string representations. If the original value can not
    // be found, then `undefined` is used.
    return str.replace(PLACE_HOLDER_REGEX, function (match, type, index) {
        if (type === 'REGEXP') {
            return regexps[index].toString();
        }

        var fn           = functions[index],
            serializedFn = fn.toString();

        if (IS_NATIVE_CODE_REGEX.test(serializedFn)) {
            throw new TypeError('Serializing native function: ' + fn.name);
        }

        return serializedFn;
    });
}
