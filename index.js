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

      // If no space option, return original behavior
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

      // Format function body with space option
      return formatFunctionWithSpace(serializedFn, options.space);
    }

    function formatFunctionWithSpace(serializedFn, space) {
      // Determine indentation unit
      var indentUnit;
      if (typeof space === 'number') {
        indentUnit = ' '.repeat(space);
      } else if (typeof space === 'string') {
        indentUnit = space;
      } else {
        return serializedFn; // fallback to original
      }

      // Find the function body opening brace (not parameter destructuring braces)
      var bodyStartBraceIndex = -1;
      var parenDepth = 0;
      var braceDepth = 0;
      
      for (var i = 0; i < serializedFn.length; i++) {
        var char = serializedFn[i];
        if (char === '(') {
          parenDepth++;
        } else if (char === ')') {
          parenDepth--;
          // After closing the parameter list, the next { is the function body
          if (parenDepth === 0) {
            for (var j = i + 1; j < serializedFn.length; j++) {
              if (serializedFn[j] === '{') {
                bodyStartBraceIndex = j;
                break;
              } else if (serializedFn[j] !== ' ' && serializedFn[j] !== '=' && serializedFn[j] !== '>') {
                // Non-space/arrow character before brace, not a function body brace
                break;
              }
            }
            break;
          }
        }
      }
      
      var closeBraceIndex = serializedFn.lastIndexOf('}');
      
      if (bodyStartBraceIndex === -1 || closeBraceIndex === -1 || bodyStartBraceIndex >= closeBraceIndex) {
        return serializedFn; // No function body braces found, return original
      }

      var signature = serializedFn.substring(0, bodyStartBraceIndex).trim();
      var body = serializedFn.substring(bodyStartBraceIndex + 1, closeBraceIndex).trim();
      
      // Clean up signature: ensure proper spacing
      // For arrow functions, add space around =>
      if (signature.includes('=>')) {
        signature = signature.replace(/\s*=>\s*/, ' => ');
      }
      
      // Ensure space before opening brace
      if (!signature.endsWith(' ')) {
        signature += ' ';
      }
      
      // If body is empty, format minimally
      if (!body) {
        return signature + '{\n' + indentUnit.repeat(2) + '}';
      }

      // Format the function body with proper indentation and spacing
      var formattedBody = formatSimpleFunctionBody(body, indentUnit);
      
      // Ensure we don't double-add closing braces
      var lines = formattedBody.split('\n');
      var lastNonEmptyIndex = lines.length - 1;
      while (lastNonEmptyIndex >= 0 && !lines[lastNonEmptyIndex].trim()) {
        lastNonEmptyIndex--;
      }
      
      if (lastNonEmptyIndex >= 0 && lines[lastNonEmptyIndex].trim() === '}') {
        // Remove the last closing brace line
        lines.splice(lastNonEmptyIndex, 1);
        formattedBody = lines.join('\n');
      }
      
      return signature + '{\n' + formattedBody + '\n' + indentUnit + '}';
    }

    function formatSimpleFunctionBody(body, indentUnit) {
      // Enhanced function body formatter that handles nested structures
      var baseIndent = indentUnit.repeat(2); // Functions are already inside objects, so depth 2
      
      // First, add spaces around operators and keywords, being careful about arrow functions
      var formatted = body
        // Protect arrow functions from being split
        .replace(/=>/g, '___ARROW___')
        // Clean up multiple spaces first
        .replace(/\s+/g, ' ')
        // Add spaces around operators (but not === or !==)
        .replace(/([^=!<>])\s*=\s*([^=])/g, '$1 = $2')
        .replace(/([^=])\s*===\s*([^=])/g, '$1 === $2')
        .replace(/([^!])\s*!==\s*([^=])/g, '$1 !== $2')
        .replace(/([^|])\s*\|\|\s*([^|])/g, '$1 || $2')
        .replace(/([^&])\s*&&\s*([^&])/g, '$1 && $2')
        // Add spaces around arithmetic operators
        .replace(/([^\s*])\s*\*\s*([^\s*])/g, '$1 * $2')
        .replace(/([^\s+])\s*\+\s*([^\s+])/g, '$1 + $2')
        .replace(/([^\s-])\s*-\s*([^\s-])/g, '$1 - $2')
        .replace(/([^\s/])\s*\/\s*([^\s/])/g, '$1 / $2')
        // Add spaces around comparison operators
        .replace(/([^\s>])\s*>\s*([^\s>=])/g, '$1 > $2')
        .replace(/([^\s<])\s*<\s*([^\s<=])/g, '$1 < $2')
        .replace(/\s*>=\s*(?![>])/g, ' >= ')
        .replace(/\s*<=\s*(?![<])/g, ' <= ')
        // Add spaces after commas
        .replace(/,(?!\s)/g, ', ')
        // Add space after control keywords and before braces
        .replace(/\b(if|for|while)\s*\(/g, '$1 (')
        .replace(/\)\s*\{/g, ') {')
        .replace(/\belse\s*\{/g, 'else {')
        .replace(/\breturn\s+([^\s])/g, 'return $1')
        // Restore arrow functions
        .replace(/___ARROW___/g, ' => ');

      // Parse and format the statements with proper line breaks and nesting
      return formatCodeWithNesting(formatted, baseIndent, indentUnit);
    }

    function formatCodeWithNesting(code, baseIndent, indentUnit) {
      var result = '';
      var lines = [];
      var current = '';
      var braceDepth = 0;
      var inString = false;
      var stringChar = '';
      
      // First pass: break into logical lines, handling } else { pattern
      for (var i = 0; i < code.length; i++) {
        var char = code[i];
        
        // Handle strings
        if (!inString && (char === '"' || char === "'" || char === '`')) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar && code[i-1] !== '\\') {
          inString = false;
          stringChar = '';
        }
        
        if (!inString) {
          if (char === '{') {
            current += char;
            lines.push(current.trim());
            current = '';
            braceDepth++;
            continue;
          } else if (char === '}') {
            if (current.trim()) {
              lines.push(current.trim());
            }
            braceDepth--;
            
            // Check for } else { pattern
            var nextNonWhitespace = '';
            var j = i + 1;
            while (j < code.length && /\s/.test(code[j])) {
              j++;
            }
            if (j < code.length - 4 && code.substring(j, j + 4) === 'else') {
              // Skip to after 'else'
              j += 4;
              while (j < code.length && /\s/.test(code[j])) {
                j++;
              }
              if (j < code.length && code[j] === '{') {
                // This is } else {
                lines.push('} else {');
                i = j; // Skip to the {
                braceDepth++;
                current = '';
                continue;
              }
            }
            
            lines.push('}');
            current = '';
            continue;
          } else if (char === ';') {
            current += char;
            lines.push(current.trim());
            current = '';
            continue;
          }
        }
        
        current += char;
      }
      
      // Add any remaining content
      if (current.trim()) {
        lines.push(current.trim());
      }
      
      // Second pass: apply proper indentation
      var currentDepth = 2; // Start at depth 2 for function bodies (object has 1, function has 2)
      for (var k = 0; k < lines.length; k++) {
        var line = lines[k].trim();
        if (!line) continue;
        
        // Adjust depth for closing braces
        if (line === '}' || line.startsWith('}')) {
          currentDepth--;
        }
        
        // Apply indentation
        result += indentUnit.repeat(currentDepth) + line;
        
        // Add newline except for last line
        if (k < lines.length - 1) {
          result += '\n';
        }
        
        // Adjust depth for opening braces
        if (line.endsWith('{')) {
          currentDepth++;
        }
        
        // Add semicolon if missing (except for braces)
        if (!line.endsWith(';') && !line.endsWith('{') && line !== '}' && !line.startsWith('}')) {
          result = result.replace(/([^;}])$/, '$1;');
        }
      }
      
      return result;
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
