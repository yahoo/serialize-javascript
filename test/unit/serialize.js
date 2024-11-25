const { beforeEach, describe, it } = require('node:test');
const { deepStrictEqual, strictEqual, throws } = require('node:assert');

var serialize = require('../../');

// temporarily monkeypatch `crypto.randomBytes` so we'll have a
// predictable UID for our tests
var crypto = require('crypto');
var oldRandom = crypto.randomBytes;
crypto.randomBytes = function(len, cb) {
    var buf = Buffer.alloc(len);
    buf.fill(0x00);
    if (cb)
        cb(null, buf);
    return buf;
};

crypto.randomBytes = oldRandom;

describe('serialize( obj )', function () {
    it('should be a function', function () {
        strictEqual(typeof serialize, 'function');
    });

    describe('undefined', function () {
        it('should serialize `undefined` to a string', function () {
            strictEqual(typeof serialize(), 'string');
            strictEqual(serialize(), 'undefined');
            strictEqual(typeof serialize(undefined), 'string');
            strictEqual(serialize(undefined), 'undefined');
        });

        it('should deserialize "undefined" to `undefined`', function () {
            strictEqual(eval(serialize()), undefined);
            strictEqual(eval(serialize(undefined)), undefined);
        });
    });

    describe('null', function () {
        it('should serialize `null` to a string', function () {
            strictEqual(typeof serialize(null), 'string');
            strictEqual(serialize(null), 'null');
        });

        it('should deserialize "null" to `null`', function () {
            strictEqual(eval(serialize(null)), null);
        });
    });

    describe('JSON', function () {
        var data;

        beforeEach(function () {
            data = {
                str : 'string',
                num : 0,
                obj : {foo: 'foo'},
                arr : [1, 2, 3],
                bool: true,
                nil : null
            };
        });

        it('should serialize JSON to a JSON string', function () {
            deepStrictEqual(serialize(data), JSON.stringify(data));
        });

        it('should deserialize a JSON string to a JSON object', function () {
            deepStrictEqual(JSON.parse(serialize(data)), data);
        });

        it('should serialize weird whitespace characters correctly', function () {
            var ws = String.fromCharCode(8232);
            deepStrictEqual(eval(serialize(ws)), ws);
        });

        it('should serialize undefined correctly', function () {
            var obj;
            var str = '{"undef":undefined,"nest":{"undef":undefined}}';
            eval('obj = ' + str);
            deepStrictEqual(serialize(obj), str);
        });
    });

    describe('functions', function () {
        it('should serialize annonymous functions', function () {
            var fn = function () {};
            strictEqual(typeof serialize(fn), 'string');
            strictEqual(serialize(fn), 'function () {}');
        });

        it('should deserialize annonymous functions', function () {
            var fn; eval('fn = ' + serialize(function () {}));
            strictEqual(typeof fn, 'function');
        });

        it('should serialize named functions', function () {
            function fn() {}
            strictEqual(typeof serialize(fn), 'string');
            strictEqual(serialize(fn), 'function fn() {}');
        });

        it('should deserialize named functions', function () {
            var fn; eval('fn = ' + serialize(function fn() {}));
            strictEqual(typeof fn, 'function');
            strictEqual(fn.name, 'fn');
        });

        it('should serialize functions with arguments', function () {
            function fn(arg1, arg2) {}
            strictEqual(serialize(fn), 'function fn(arg1, arg2) {}');
        });

        it('should deserialize functions with arguments', function () {
            var fn; eval('fn = ' + serialize(function (arg1, arg2) {}));
            strictEqual(typeof fn, 'function');
            strictEqual(fn.length, 2);
        });

        it('should serialize functions with bodies', function () {
            function fn() { return true; }
            strictEqual(serialize(fn), 'function fn() { return true; }');
        });

        it('should deserialize functions with bodies', function () {
            var fn; eval('fn = ' + serialize(function () { return true; }));
            strictEqual(typeof fn, 'function');
            strictEqual(fn(), true);
        });

        it('should throw a TypeError when serializing native built-ins', function () {
            var err;
            strictEqual(Number.toString(), 'function Number() { [native code] }');
            try { serialize(Number); } catch (e) { err = e; }
            strictEqual(err instanceof TypeError, true);
        });

        it('should serialize enhanced literal objects', function () {
            var obj = {
                foo() { return true; },
                *bar() { return true; }
            };

            deepStrictEqual(serialize(obj), '{"foo":function() { return true; },"bar":function*() { return true; }}');
        });

        it('should deserialize enhanced literal objects', function () {
            var obj;
            eval('obj = ' + serialize({ hello() { return true; } }));

            strictEqual(obj.hello(), true);
        });

        it('should serialize functions that contain dates', function () {
            function fn(arg1) {return new Date('2016-04-28T22:02:17.156Z')};
            strictEqual(typeof serialize(fn), 'string');
            strictEqual(serialize(fn), 'function fn(arg1) {return new Date(\'2016-04-28T22:02:17.156Z\')}');
        });

        it('should deserialize functions that contain dates', function () {
            var fn; eval('fn = ' + serialize(function () { return new Date('2016-04-28T22:02:17.156Z') }));
            strictEqual(typeof fn, 'function');
            strictEqual(fn().getTime(), new Date('2016-04-28T22:02:17.156Z').getTime());
        });

        it('should serialize functions that return other functions', function () {
            function fn() {return function(arg1) {return arg1 + 5}};
            strictEqual(typeof serialize(fn), 'string');
            strictEqual(serialize(fn), 'function fn() {return function(arg1) {return arg1 + 5}}');
        });

        it('should deserialize functions that return other functions', function () {
            var fn; eval('fn = ' + serialize(function () { return function(arg1) {return arg1 + 5} }));
            strictEqual(typeof fn, 'function');
            strictEqual(fn()(7), 12);
        });
    });

    describe('arrow-functions', function () {
        it('should serialize arrow functions', function () {
            var fn = () => {};
            strictEqual(typeof serialize(fn), 'string');
            strictEqual(serialize(fn), '() => {}');
        });

        it('should deserialize arrow functions', function () {
            var fn; eval('fn = ' + serialize(() => true));
            strictEqual(typeof fn, 'function');
            strictEqual(fn(), true);
        });

        it('should serialize arrow functions with one argument', function () {
            var fn = arg1 => {}
            strictEqual(typeof serialize(fn), 'string');
            strictEqual(serialize(fn), 'arg1 => {}');
        });

        it('should deserialize arrow functions with one argument', function () {
            var fn; eval('fn = ' + serialize(arg1 => {}));
            strictEqual(typeof fn, 'function');
            strictEqual(fn.length, 1);
        });

        it('should serialize arrow functions with multiple arguments', function () {
            var fn = (arg1, arg2) => {}
            strictEqual(serialize(fn), '(arg1, arg2) => {}');
        });

        it('should deserialize arrow functions with multiple arguments', function () {
            var fn; eval('fn = ' + serialize( (arg1, arg2) => {}));
            strictEqual(typeof fn, 'function');
            strictEqual(fn.length, 2);
        });

        it('should serialize arrow functions with bodies', function () {
            var fn = () => { return true; }
            strictEqual(serialize(fn), '() => { return true; }');
        });

        it('should deserialize arrow functions with bodies', function () {
            var fn; eval('fn = ' + serialize( () => { return true; }));
            strictEqual(typeof fn, 'function');
            strictEqual(fn(), true);
        });

        it('should serialize enhanced literal objects', function () {
            var obj = {
                foo: () => { return true; },
                bar: arg1 => { return true; },
                baz: (arg1, arg2) => { return true; }
            };

            strictEqual(serialize(obj), '{"foo":() => { return true; },"bar":arg1 => { return true; },"baz":(arg1, arg2) => { return true; }}');
        });

        it('should deserialize enhanced literal objects', function () {
            var obj;
            eval('obj = ' + serialize({                foo: () => { return true; },
                foo: () => { return true; },
                bar: arg1 => { return true; },
                baz: (arg1, arg2) => { return true; }
            }));

            strictEqual(obj.foo(), true);
            strictEqual(obj.bar('arg1'), true);
            strictEqual(obj.baz('arg1', 'arg1'), true);
        });

        it('should serialize arrow functions with added properties', function () {
            var fn = () => {};
            fn.property1 = 'a string'
            strictEqual(typeof serialize(fn), 'string');
            strictEqual(serialize(fn), '() => {}');
        });

        it('should deserialize arrow functions with added properties', function () {
            var fn; eval('fn = ' + serialize( () => { this.property1 = 'a string'; return 5 }));
            strictEqual(typeof fn, 'function');
            strictEqual(fn(), 5);
        });

        it('should serialize arrow functions that return other functions', function () {
            var fn = arg1 => { return arg2 => arg1 + arg2 };
            strictEqual(typeof serialize(fn), 'string');
            strictEqual(serialize(fn), 'arg1 => { return arg2 => arg1 + arg2 }');
        });

        it('should deserialize arrow functions that return other functions', function () {
            var fn; eval('fn = ' + serialize(arg1 => { return arg2 => arg1 + arg2 } ));
            strictEqual(typeof fn, 'function');
            strictEqual(fn(2)(3), 5);
        });
    });

    describe('regexps', function () {
        it('should serialize constructed regexps', function () {
            var re = new RegExp('asdf');
            strictEqual(typeof serialize(re), 'string');
            strictEqual(serialize(re), 'new RegExp("asdf", "")');
        });

        it('should deserialize constructed regexps', function () {
            var re = eval(serialize(new RegExp('asdf')));
            strictEqual(re instanceof RegExp, true);
            strictEqual(re.source, 'asdf');
        });

        it('should serialize literal regexps', function () {
            var re = /asdf/;
            strictEqual(typeof serialize(re), 'string');
            strictEqual(serialize(re), 'new RegExp("asdf", "")');
        });

        it('should deserialize literal regexps', function () {
            var re = eval(serialize(/asdf/));
            strictEqual(re instanceof RegExp, true);
            strictEqual(re.source, 'asdf');
        });

        it('should serialize regexps with flags', function () {
            var re = /^asdf$/gi;
            strictEqual(serialize(re), 'new RegExp("^asdf$", "gi")');
        });

        it('should deserialize regexps with flags', function () {
            var re = eval(serialize(/^asdf$/gi));
            strictEqual(re instanceof RegExp, true);
            strictEqual(re.global, true);
            strictEqual(re.ignoreCase, true);
            strictEqual(re.multiline, false);
        });

        it('should serialize regexps with escaped chars', function () {
            strictEqual(serialize(/\..*/), 'new RegExp("\\\\..*", "")');
            strictEqual(serialize(new RegExp('\\..*')), 'new RegExp("\\\\..*", "")');
        });

        it('should deserialize regexps with escaped chars', function () {
            var re = eval(serialize(/\..*/));
            strictEqual(re instanceof RegExp, true);
            strictEqual(re.source, '\\..*');
            re = eval(serialize(new RegExp('\\..*')));
            strictEqual(re instanceof RegExp, true);
            strictEqual(re.source, '\\..*');
        });

        it('should serialize dangerous regexps', function () {
            var re = /[<\/script><script>alert('xss')\/\/]/
            strictEqual(typeof serialize(re), 'string');
            strictEqual(serialize(re), 'new RegExp("[\\u003C\\\\\\u002Fscript\\u003E\\u003Cscript\\u003Ealert(\'xss\')\\\\\\u002F\\\\\\u002F]", "")');
        });
    });

    describe('dates', function () {
        it('should serialize dates', function () {
            var d = new Date('2016-04-28T22:02:17.156Z');
            strictEqual(typeof serialize(d), 'string');
            strictEqual(serialize(d), 'new Date("2016-04-28T22:02:17.156Z")');
            strictEqual(typeof serialize({t: [d]}), 'string');
            strictEqual(serialize({t: [d]}), '{"t":[new Date("2016-04-28T22:02:17.156Z")]}');
        });

        it('should deserialize a date', function () {
            var d = eval(serialize(new Date('2016-04-28T22:02:17.156Z')));
            strictEqual(d instanceof Date, true);
            strictEqual(d.toISOString(), '2016-04-28T22:02:17.156Z');
        });

        it('should deserialize a string that is not a valid date', function () {
            var d = eval(serialize('2016-04-28T25:02:17.156Z'));
            strictEqual(typeof d, 'string');
            strictEqual(d, '2016-04-28T25:02:17.156Z');
        });

        it('should serialize dates within objects', function () {
            var d = {foo: new Date('2016-04-28T22:02:17.156Z')};
            strictEqual(typeof serialize(d), 'string');
            strictEqual(serialize(d), '{"foo":new Date("2016-04-28T22:02:17.156Z")}');
            strictEqual(typeof serialize({t: [d]}), 'string');
            strictEqual(serialize({t: [d]}), '{"t":[{"foo":new Date("2016-04-28T22:02:17.156Z")}]}');
        });
    });

    describe('maps', function () {
        it('should serialize maps', function () {
            var regexKey = /.*/;
            var m = new Map([
                ['a', 123],
                [regexKey, 456],
                [Infinity, 789]
            ]);
            strictEqual(typeof serialize(m), 'string');
            strictEqual(serialize(m), 'new Map([["a",123],[new RegExp(".*", ""),456],[Infinity,789]])');
            strictEqual(typeof serialize({t: [m]}), 'string');
            strictEqual(serialize({t: [m]}), '{"t":[new Map([["a",123],[new RegExp(".*", ""),456],[Infinity,789]])]}');
        });

        it('should deserialize a map', function () {
            var m = eval(serialize(new Map([
                ['a', 123],
                [null, 456],
                [Infinity, 789]
            ])));
            strictEqual(m instanceof Map, true);
            strictEqual(m.get(null), 456);
        });
    });

    describe('sets', function () {
        it('should serialize sets', function () {
            var regex = /.*/;
            var m = new Set([
                'a',
                123,
                regex,
                Infinity
            ]);
            strictEqual(typeof serialize(m), 'string');
            strictEqual(serialize(m), 'new Set(["a",123,new RegExp(".*", ""),Infinity])');
            strictEqual(typeof serialize({t: [m]}), 'string');
            strictEqual(serialize({t: [m]}), '{"t":[new Set(["a",123,new RegExp(".*", ""),Infinity])]}');
        });

        it('should deserialize a set', function () {
            var m = eval(serialize(new Set([
                'a',
                123,
                null,
                Infinity
            ])));
            strictEqual(m instanceof Set, true);
            strictEqual(m.has(null), true);
        });
    });

    describe('sparse arrays', function () {
        it('should serialize sparse arrays', function () {
            var a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            delete a[0];
            a.length = 3;
            a[5] = "wat"
            strictEqual(typeof serialize(a), 'string');
            strictEqual(serialize(a), 'Array.prototype.slice.call({"1":2,"2":3,"5":"wat","length":6})');
            strictEqual(typeof serialize({t: [a]}), 'string');
            strictEqual(serialize({t: [a]}), '{"t":[Array.prototype.slice.call({"1":2,"2":3,"5":"wat","length":6})]}');
        });

        it('should deserialize a sparse array', function () {
            var a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            delete a[0];
            a.length = 3;
            a[5] = "wat"
            var b = eval(serialize(a));
            strictEqual(b instanceof Array, true);
            deepStrictEqual(b, [ , 2, 3, , , 'wat' ]);
        });
    });

    describe('Infinity', function () {
        it('should serialize Infinity', function () {
            strictEqual(serialize(Infinity), 'Infinity');
            strictEqual(typeof serialize({t: [Infinity]}), 'string');
            strictEqual(serialize({t: [Infinity]}), '{"t":[Infinity]}');
        });

        it('should deserialize Infinity', function () {
            var d = eval(serialize(Infinity));
            strictEqual(d, Infinity);
        });

        it('should serialize -Infinity', function () {
            strictEqual(serialize(-Infinity), '-Infinity');
            strictEqual(typeof serialize({t: [-Infinity]}), 'string');
            strictEqual(serialize({t: [-Infinity]}), '{"t":[-Infinity]}');
        });

        it('should deserialize -Infinity', function () {
            var d = eval(serialize(-Infinity));
            strictEqual(d, -Infinity);
        });
    });

    describe('BigInt', function () {
        it('should serialize BigInt', function () {
            var b = BigInt(9999);
            strictEqual(serialize(b), 'BigInt("9999")');
            strictEqual(typeof serialize({t: [b]}), 'string');
            strictEqual(serialize({t: [b]}), '{"t":[BigInt("9999")]}');
        });

        it('should serialize 0n', function () {
            var b = BigInt(0);
            strictEqual(serialize(b), 'BigInt("0")');
            strictEqual(typeof serialize({t: [b]}), 'string');
            strictEqual(serialize({t: [b]}), '{"t":[BigInt("0")]}');
        });

        it('should deserialize BigInt', function () {
            var d = eval(serialize(BigInt(9999)));
            strictEqual(typeof d, 'bigint');
            strictEqual(d.toString(), '9999');
        });

        it('should throw error for invalid bigint', function () {
            throws(() => serialize(BigInt('abc')), Error);
        });
    });

    describe('URL', function () {
        it('should serialize URL', function () {
            var u = new URL('https://x.com/')
            strictEqual(serialize(u), 'new URL("https:\\u002F\\u002Fx.com\\u002F")');
            strictEqual(typeof serialize({t: [u]}), 'string');
            strictEqual(serialize({t: [u]}), '{"t":[new URL("https:\\u002F\\u002Fx.com\\u002F")]}');
        });

        it('should deserialize URL', function () {
            var d = eval(serialize(new URL('https://x.com/')));
            strictEqual(d instanceof URL, true);
            strictEqual(d.toString(), 'https://x.com/');
        });
    });

    describe('XSS', function () {
        it('should encode unsafe HTML chars to Unicode', function () {
            strictEqual(serialize('</script>'), '"\\u003C\\u002Fscript\\u003E"');
            strictEqual(JSON.parse(serialize('</script>')), '</script>');
            strictEqual(eval(serialize('</script>')), '</script>');
            strictEqual(serialize(new URL('x:</script>')), 'new URL("x:\\u003C\\u002Fscript\\u003E")');
            strictEqual(eval(serialize(new URL('x:</script>'))).href, 'x:</script>');
        });
    });

    describe('options', function () {
        it('should accept options as the second argument', function () {
            strictEqual(serialize('foo', {}), '"foo"');
        });

        it('should accept a `space` option', function () {
            strictEqual(serialize([1], {space: 0}), '[1]');
            strictEqual(serialize([1], {space: ''}), '[1]');
            strictEqual(serialize([1], {space: undefined}), '[1]');
            strictEqual(serialize([1], {space: null}), '[1]');
            strictEqual(serialize([1], {space: false}), '[1]');

            strictEqual(serialize([1], {space: 1}), '[\n 1\n]');
            strictEqual(serialize([1], {space: ' '}), '[\n 1\n]');
            strictEqual(serialize([1], {space: 2}), '[\n  1\n]');
        });

        it('should accept a `isJSON` option', function () {
            strictEqual(serialize('foo', {isJSON: true}), '"foo"');
            strictEqual(serialize('foo', {isJSON: false}), '"foo"');

            function fn() { return true; }

            strictEqual(serialize(fn), 'function fn() { return true; }');
            strictEqual(serialize(fn, {isJSON: false}), 'function fn() { return true; }');

            strictEqual(serialize(fn, {isJSON: true}), 'undefined');
            strictEqual(serialize([1], {isJSON: true, space: 2}), '[\n  1\n]');
        });

        it('should accept a `unsafe` option', function () {
            strictEqual(serialize('foo', {unsafe: true}), '"foo"');
            strictEqual(serialize('foo', {unsafe: false}), '"foo"');

            function fn() { return true; }

            strictEqual(serialize(fn), 'function fn() { return true; }');
            strictEqual(serialize(fn, {unsafe: false}), 'function fn() { return true; }');
            strictEqual(serialize(fn, {unsafe: undefined}), 'function fn() { return true; }');
            strictEqual(serialize(fn, {unsafe: "true"}), 'function fn() { return true; }');

            strictEqual(serialize(fn, {unsafe: true}), 'function fn() { return true; }');
            strictEqual(serialize(["1"], {unsafe: false, space: 2}), '[\n  "1"\n]');
            strictEqual(serialize(["1"], {unsafe: true, space: 2}), '[\n  "1"\n]');
            strictEqual(serialize(["<"], {space: 2}), '[\n  "\\u003C"\n]');
            strictEqual(serialize(["<"], {unsafe: true, space: 2}), '[\n  "<"\n]');
        });

        it("should accept a `ignoreFunction` option", function() {
            function fn() { return true; }
            var obj = {
                fn: fn,
                fn_arrow: () => {
                    return true;
                }
            };            
            var obj2 = {
                num: 123,
                str: 'str',
                fn: fn
            }
            // case 1. Pass function to serialize
            strictEqual(serialize(fn, { ignoreFunction: true }), 'undefined');
            // case 2. Pass function(arrow) in object to serialze
            strictEqual(serialize(obj, { ignoreFunction: true }), '{}');
            // case 3. Other features should work
            strictEqual(serialize(obj2, { ignoreFunction: true }), 
              '{"num":123,"str":"str"}'
            );
        });
    });

    describe('backwards-compatability', function () {
        it('should accept `space` as the second argument', function () {
            strictEqual(serialize([1], 0), '[1]');
            strictEqual(serialize([1], ''), '[1]');
            strictEqual(serialize([1], undefined), '[1]');
            strictEqual(serialize([1], null), '[1]');
            strictEqual(serialize([1], false), '[1]');

            strictEqual(serialize([1], 1), '[\n 1\n]');
            strictEqual(serialize([1], ' '), '[\n 1\n]');
            strictEqual(serialize([1], 2), '[\n  1\n]');
        });
    });

    describe('placeholders', function() {
        it('should not be replaced within string literals', function () {
            // Since we made the UID deterministic this should always be the placeholder
            var fakePlaceholder = '"@__R-0000000000000000-0__@';
            var serialized = serialize({bar: /1/i, foo: fakePlaceholder}, {uid: 'foo'});
            var obj = eval('(' + serialized + ')');
            strictEqual(typeof obj, 'object');
            strictEqual(typeof obj.foo, 'string');
            strictEqual(obj.foo, fakePlaceholder);
        });
    });

});
