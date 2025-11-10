/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Copyrights licensed under the New BSD License.
See the accompanying LICENSE file for terms.
*/

'use strict';

// Generate an internal UID to make the regexp pattern harder to guess.
var UID_LENGTH          = 16;
var UID                 = generateUID();
var PLACE_HOLDER_REGEXP = new RegExp('(\\\\)?"@__(F|R|D|M|S|A|U|I|B|L)-' + UID + '-(\\d+)__@"', 'g');

var IS_NATIVE_CODE_REGEXP = /\{\s*\[native code\]\s*\}/g;
var IS_PURE_FUNCTION = /function.*?\(/;
var IS_ARROW_FUNCTION = /.*?=>.*?/;
var UNSAFE_CHARS_REGEXP   = /[<>\/\u2028\u2029]/g;

var RESERVED_SYMBOLS = ['*', 'async'];

// Mapping of unsafe HTML and invalid JavaScript line terminator chars to their
// Unicode char counterparts which are safe to use in JavaScript strings.
var ESCAPED_CHARS = {
    '<'     : '\\u003C',
    '>'     : '\\u003E',
    '/'     : '\\u002F',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029'
};

function escapeUnsafeChars(unsafeChar) {
    return ESCAPED_CHARS[unsafeChar];
}

function generateUID() {
    var bytes = crypto.getRandomValues(new Uint8Array(UID_LENGTH));
    var result = '';
    for(var i=0; i<UID_LENGTH; ++i) {
        result += bytes[i].toString(16);
    }
    return result;
}

function deleteFunctions(obj){
    var functionKeys = [];
    for (var key in obj) {
        if (typeof obj[key] === "function") {
            functionKeys.push(key);
        }
    }
    for (var i = 0; i < functionKeys.length; i++) {
        delete obj[functionKeys[i]];
    }
}

module.exports = function serialize(obj, options) {
    options || (options = {});

    // Backwards-compatibility for `space` as the second argument.
    if (typeof options === 'number' || typeof options === 'string') {
        options = {space: options};
    }

    var functions = [];
    var regexps   = [];
    var dates     = [];
    var maps      = [];
    var sets      = [];
    var arrays    = [];
    var undefs    = [];
    var infinities= [];
    var bigInts = [];
    var urls = [];

    // Returns placeholders for functions and regexps (identified by index)
    // which are later replaced by their string representation.
    function replacer(key, value) {

        // For nested function
        if(options.ignoreFunction){
            deleteFunctions(value);
        }

        if (!value && value !== undefined && value !== BigInt(0)) {
            return value;
        }

        // If the value is an object w/ a toJSON method, toJSON is called before
        // the replacer runs, so we use this[key] to get the non-toJSONed value.
        var origValue = this[key];
        var type = typeof origValue;

        if (type === 'object') {
            if(origValue instanceof RegExp) {
                return '@__R-' + UID + '-' + (regexps.push(origValue) - 1) + '__@';
            }

            if(origValue instanceof Date) {
                return '@__D-' + UID + '-' + (dates.push(origValue) - 1) + '__@';
            }

            if(origValue instanceof Map) {
                return '@__M-' + UID + '-' + (maps.push(origValue) - 1) + '__@';
            }

            if(origValue instanceof Set) {
                return '@__S-' + UID + '-' + (sets.push(origValue) - 1) + '__@';
            }

            if(origValue instanceof Array) {
                var isSparse = origValue.filter(function(){return true}).length !== origValue.length;
                if (isSparse) {
                    return '@__A-' + UID + '-' + (arrays.push(origValue) - 1) + '__@';
                }
            }

            if(origValue instanceof URL) {
                return '@__L-' + UID + '-' + (urls.push(origValue) - 1) + '__@';
            }
        }

        if (type === 'function') {
            return '@__F-' + UID + '-' + (functions.push(origValue) - 1) + '__@';
        }

        if (type === 'undefined') {
            return '@__U-' + UID + '-' + (undefs.push(origValue) - 1) + '__@';
        }

        if (type === 'number' && !isNaN(origValue) && !isFinite(origValue)) {
            return '@__I-' + UID + '-' + (infinities.push(origValue) - 1) + '__@';
        }

        if (type === 'bigint') {
            return '@__B-' + UID + '-' + (bigInts.push(origValue) - 1) + '__@';
        }

        return value;
    }

    function serializeFunc(fn, options) {
        var serializedFn = fn.toString();
        if (IS_NATIVE_CODE_REGEXP.test(serializedFn)) {
            throw new TypeError('Serializing native function: ' + fn.name);
        }

        // If no space option, use original behavior
        if (!options || !options.space) {
            // pure functions, example: {key: function() {}}
            if(IS_PURE_FUNCTION.test(serializedFn)) {
                return serializedFn;
            }

            // arrow functions, example: arg1 => arg1+5
            if(IS_ARROW_FUNCTION.test(serializedFn)) {
                return serializedFn;
            }

            var argsStartsAt = serializedFn.indexOf('(');
            var def = serializedFn.substr(0, argsStartsAt)
              .trim()
              .split(' ')
              .filter(function(val) { return val.length > 0 });

            var nonReservedSymbols = def.filter(function(val) {
              return RESERVED_SYMBOLS.indexOf(val) === -1
            });

            // enhanced literal objects, example: {key() {}}
            if(nonReservedSymbols.length > 0) {
                return (def.indexOf('async') > -1 ? 'async ' : '') + 'function'
                  + (def.join('').indexOf('*') > -1 ? '*' : '')
                  + serializedFn.substr(argsStartsAt);
            }

            // arrow functions
            return serializedFn;
        }

        // Format function with space option - much simpler approach
        return formatFunctionWithSpace(serializedFn, options.space);
    }

    function formatFunctionWithSpace(serializedFn, space) {
        // Determine indent string
        var indent = typeof space === 'number' ? ' '.repeat(space) : (space || '  ');
        var functionIndent = indent.repeat(2); // Functions are at depth 2 (inside object)
        
        // Find function body bounds - need to find the { that's after the parameter list
        var parenDepth = 0;
        var bodyStart = -1;
        
        for (var i = 0; i < serializedFn.length; i++) {
            var char = serializedFn[i];
            if (char === '(') {
                parenDepth++;
            } else if (char === ')') {
                parenDepth--;
            } else if (char === '{' && parenDepth === 0) {
                // This is a brace outside of parentheses, likely the function body
                bodyStart = i;
                break;
            }
        }
        
        var bodyEnd = serializedFn.lastIndexOf('}');
        
        if (bodyStart === -1 || bodyEnd === -1 || bodyStart >= bodyEnd) {
            return serializedFn; // No function body found
        }
        
        var signature = serializedFn.substring(0, bodyStart).trim();
        var body = serializedFn.substring(bodyStart + 1, bodyEnd).trim();
        
        // Clean up signature spacing for arrow functions
        if (signature.includes('=>')) {
            signature = signature.replace(/\s*=>\s*/, ' => ');
        }
        
        // Handle empty body
        if (!body) {
            return signature + ' {\n' + functionIndent + '\n' + indent + '}';
        }
        
        // Minimal formatting: split by semicolons and add basic spacing
        var statements = body.split(';').filter(function(s) { return s.trim(); });
        var formattedStatements = statements.map(function(stmt) {
            var trimmed = stmt.trim();
            
            // Basic operator spacing (minimal set to avoid complexity)
            trimmed = trimmed
                .replace(/===(?!=)/g, ' === ')
                .replace(/!==(?!=)/g, ' !== ')
                .replace(/([^=])=([^=])/g, '$1 = $2')
                .replace(/\|\|/g, ' || ')
                .replace(/&&/g, ' && ')
                .replace(/,(?!\s)/g, ', ')
                .replace(/\s+/g, ' ');
            
            return functionIndent + trimmed + (trimmed ? ';' : '');
        });
        
        return signature + ' {\n' + formattedStatements.join('\n') + '\n' + indent + '}';
    }    // Check if the parameter is function
    if (options.ignoreFunction && typeof obj === "function") {
        obj = undefined;
    }
    // Protects against `JSON.stringify()` returning `undefined`, by serializing
    // to the literal string: "undefined".
    if (obj === undefined) {
        return String(obj);
    }

    var str;

    // Creates a JSON string representation of the value.
    // NOTE: Node 0.12 goes into slow mode with extra JSON.stringify() args.
    if (options.isJSON && !options.space) {
        str = JSON.stringify(obj);
    } else {
        str = JSON.stringify(obj, options.isJSON ? null : replacer, options.space);
    }

    // Protects against `JSON.stringify()` returning `undefined`, by serializing
    // to the literal string: "undefined".
    if (typeof str !== 'string') {
        return String(str);
    }

    // Replace unsafe HTML and invalid JavaScript line terminator chars with
    // their safe Unicode char counterpart. This _must_ happen before the
    // regexps and functions are serialized and added back to the string.
    if (options.unsafe !== true) {
        str = str.replace(UNSAFE_CHARS_REGEXP, escapeUnsafeChars);
    }

    if (functions.length === 0 && regexps.length === 0 && dates.length === 0 && maps.length === 0 && sets.length === 0 && arrays.length === 0 && undefs.length === 0 && infinities.length === 0 && bigInts.length === 0 && urls.length === 0) {
        return str;
    }

    // Replaces all occurrences of function, regexp, date, map and set placeholders in the
    // JSON string with their string representations. If the original value can
    // not be found, then `undefined` is used.
    return str.replace(PLACE_HOLDER_REGEXP, function (match, backSlash, type, valueIndex) {
        // The placeholder may not be preceded by a backslash. This is to prevent
        // replacing things like `"a\"@__R-<UID>-0__@"` and thus outputting
        // invalid JS.
        if (backSlash) {
            return match;
        }

        if (type === 'D') {
            return "new Date(\"" + dates[valueIndex].toISOString() + "\")";
        }

        if (type === 'R') {
            return "new RegExp(" + serialize(regexps[valueIndex].source) + ", \"" + regexps[valueIndex].flags + "\")";
        }

        if (type === 'M') {
            return "new Map(" + serialize(Array.from(maps[valueIndex].entries()), options) + ")";
        }

        if (type === 'S') {
            return "new Set(" + serialize(Array.from(sets[valueIndex].values()), options) + ")";
        }

        if (type === 'A') {
            return "Array.prototype.slice.call(" + serialize(Object.assign({ length: arrays[valueIndex].length }, arrays[valueIndex]), options) + ")";
        }

        if (type === 'U') {
            return 'undefined'
        }

        if (type === 'I') {
            return infinities[valueIndex];
        }

        if (type === 'B') {
            return "BigInt(\"" + bigInts[valueIndex] + "\")";
        }

        if (type === 'L') {
            return "new URL(" + serialize(urls[valueIndex].toString(), options) + ")";
        }

        var fn = functions[valueIndex];

        return serializeFunc(fn, options);
    });
}
