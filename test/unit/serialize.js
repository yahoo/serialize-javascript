/* global describe, it, beforeEach */
'use strict';

var serialize = require('../../'),
    expect    = require('chai').expect;

describe('serialize( obj )', function () {
    it('should be a function', function () {
        expect(serialize).to.be.a('function');
    });

    describe('undefined', function () {
        it('should serialize `undefined` to a string', function () {
            expect(serialize()).to.be.a('string').equal('undefined');
            expect(serialize(undefined)).to.be.a('string').equal('undefined');
        });

        it('should deserialize "undefined" to `undefined`', function () {
            expect(eval(serialize())).to.equal(undefined);
            expect(eval(serialize(undefined))).to.equal(undefined);
        });
    });

    describe('null', function () {
        it('should serialize `null` to a string', function () {
            expect(serialize(null)).to.be.a('string').equal('null');
        });

        it('should deserialize "null" to `null`', function () {
            expect(eval(serialize(null))).to.equal(null);
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
            expect(serialize(data)).to.equal(JSON.stringify(data));
        });

        it('should deserialize a JSON string to a JSON object', function () {
            expect(JSON.parse(serialize(data))).to.deep.equal(data);
        });

        it('should serialize weird whitespace characters correctly', function () {
            var ws = String.fromCharCode(8232);
            expect(eval(serialize(ws))).to.equal(ws);
        });

        it('should serialize undefined correctly', function () {
            var obj;
            var str = '{"undef":undefined,"nest":{"undef":undefined}}';
            eval('obj = ' + str);
            expect(serialize(obj)).to.equal(str);
        });
    });

    describe('functions', function () {
        it('should serialize annonymous functions', function () {
            var fn = function () {};
            expect(serialize(fn)).to.be.a('string').equal('function () {}');
        });

        it('should deserialize annonymous functions', function () {
            var fn; eval('fn = ' + serialize(function () {}));
            expect(fn).to.be.a('function');
        });

        it('should serialize named functions', function () {
            function fn() {}
            expect(serialize(fn)).to.be.a('string').equal('function fn() {}');
        });

        it('should deserialize named functions', function () {
            var fn; eval('fn = ' + serialize(function fn() {}));
            expect(fn).to.be.a('function');
            expect(fn.name).to.equal('fn');
        });

        it('should serialize functions with arguments', function () {
            function fn(arg1, arg2) {}
            expect(serialize(fn)).to.equal('function fn(arg1, arg2) {}');
        });

        it('should deserialize functions with arguments', function () {
            var fn; eval('fn = ' + serialize(function (arg1, arg2) {}));
            expect(fn).to.be.a('function');
            expect(fn.length).to.equal(2);
        });

        it('should serialize functions with bodies', function () {
            function fn() { return true; }
            expect(serialize(fn)).to.equal('function fn() { return true; }');
        });

        it('should deserialize functions with bodies', function () {
            var fn; eval('fn = ' + serialize(function () { return true; }));
            expect(fn).to.be.a('function');
            expect(fn()).to.equal(true);
        });

        it('should throw a TypeError when serializing native built-ins', function () {
            var err;
            expect(Number.toString()).to.equal('function Number() { [native code] }');
            try { serialize(Number); } catch (e) { err = e; }
            expect(err).to.be.an.instanceOf(TypeError);
        });

        it('should serialize enhanced literal objects', function () {
            var obj = {
                foo() { return true; },
                *bar() { return true; }
            };

            expect(serialize(obj)).to.equal('{"foo":function() { return true; },"bar":function*() { return true; }}');
        });

        it('should deserialize enhanced literal objects', function () {
            var obj;
            eval('obj = ' + serialize({ hello() { return true; } }));

            expect(obj.hello()).to.equal(true);
        });

        it('should serialize functions that contain dates', function () {
           function fn(arg1) {return new Date('2016-04-28T22:02:17.156Z')};
            expect(serialize(fn)).to.be.a('string').equal('function fn(arg1) {return new Date(\'2016-04-28T22:02:17.156Z\')}');
        });

        it('should deserialize functions that contain dates', function () {
            var fn; eval('fn = ' + serialize(function () { return new Date('2016-04-28T22:02:17.156Z') }));
            expect(fn).to.be.a('function');
            expect(fn().getTime()).to.equal(new Date('2016-04-28T22:02:17.156Z').getTime());
        });

        it('should serialize functions that return other functions', function () {
            function fn() {return function(arg1) {return arg1 + 5}};
            expect(serialize(fn)).to.be.a('string').equal('function fn() {return function(arg1) {return arg1 + 5}}');
        });

        it('should deserialize functions that return other functions', function () {
            var fn; eval('fn = ' + serialize(function () { return function(arg1) {return arg1 + 5} }));
            expect(fn).to.be.a('function');
            expect(fn()(7)).to.equal(12);
        });
    });

    describe('arrow-functions', function () {
        it('should serialize arrow functions', function () {
            var fn = () => {};
            expect(serialize(fn)).to.be.a('string').equal('() => {}');
        });

        it('should deserialize arrow functions', function () {
            var fn; eval('fn = ' + serialize(() => true));
            expect(fn).to.be.a('function');
            expect(fn()).to.equal(true);
        });

        it('should serialize arrow functions with one argument', function () {
            var fn = arg1 => {}
            expect(serialize(fn)).to.be.a('string').equal('arg1 => {}');
        });

        it('should deserialize arrow functions with one argument', function () {
            var fn; eval('fn = ' + serialize(arg1 => {}));
            expect(fn).to.be.a('function');
            expect(fn.length).to.equal(1);
        });

        it('should serialize arrow functions with multiple arguments', function () {
            var fn = (arg1, arg2) => {}
            expect(serialize(fn)).to.equal('(arg1, arg2) => {}');
        });

        it('should deserialize arrow functions with multiple arguments', function () {
            var fn; eval('fn = ' + serialize( (arg1, arg2) => {}));
            expect(fn).to.be.a('function');
            expect(fn.length).to.equal(2);
        });

        it('should serialize arrow functions with bodies', function () {
            var fn = () => { return true; }
            expect(serialize(fn)).to.equal('() => { return true; }');
        });

        it('should deserialize arrow functions with bodies', function () {
            var fn; eval('fn = ' + serialize( () => { return true; }));
            expect(fn).to.be.a('function');
            expect(fn()).to.equal(true);
        });

        it('should serialize enhanced literal objects', function () {
            var obj = {
                foo: () => { return true; },
                bar: arg1 => { return true; },
                baz: (arg1, arg2) => { return true; }
            };

            expect(serialize(obj)).to.equal('{"foo":() => { return true; },"bar":arg1 => { return true; },"baz":(arg1, arg2) => { return true; }}');
        });

        it('should deserialize enhanced literal objects', function () {
            var obj;
            eval('obj = ' + serialize({                foo: () => { return true; },
                foo: () => { return true; },
                bar: arg1 => { return true; },
                baz: (arg1, arg2) => { return true; }
            }));

            expect(obj.foo()).to.equal(true);
            expect(obj.bar('arg1')).to.equal(true);
            expect(obj.baz('arg1', 'arg1')).to.equal(true);
        });

        it('should serialize arrow functions with added properties', function () {
            var fn = () => {};
            fn.property1 = 'a string'
            expect(serialize(fn)).to.be.a('string').equal('() => {}');
        });

        it('should deserialize arrow functions with added properties', function () {
            var fn; eval('fn = ' + serialize( () => { this.property1 = 'a string'; return 5 }));
            expect(fn).to.be.a('function');
            expect(fn()).to.equal(5);
        });

         it('should serialize arrow functions that return other functions', function () {
            var fn = arg1 => { return arg2 => arg1 + arg2 };
            expect(serialize(fn)).to.be.a('string').equal('arg1 => { return arg2 => arg1 + arg2 }');
          });

        it('should deserialize arrow functions that return other functions', function () {
            var fn; eval('fn = ' + serialize(arg1 => { return arg2 => arg1 + arg2 } ));
            expect(fn).to.be.a('function');
            expect(fn(2)(3)).to.equal(5);
        });
    });

    describe('regexps', function () {
        it('should serialize constructed regexps', function () {
            var re = new RegExp('asdf');
            expect(serialize(re)).to.be.a('string').equal('new RegExp("asdf", "")');
        });

        it('should deserialize constructed regexps', function () {
            var re = eval(serialize(new RegExp('asdf')));
            expect(re).to.be.a('RegExp');
            expect(re.source).to.equal('asdf');
        });

        it('should serialize literal regexps', function () {
            var re = /asdf/;
            expect(serialize(re)).to.be.a('string').equal('new RegExp("asdf", "")');
        });

        it('should deserialize literal regexps', function () {
            var re = eval(serialize(/asdf/));
            expect(re).to.be.a('RegExp');
            expect(re.source).to.equal('asdf');
        });

        it('should serialize regexps with flags', function () {
            var re = /^asdf$/gi;
            expect(serialize(re)).to.equal('new RegExp("^asdf$", "gi")');
        });

        it('should deserialize regexps with flags', function () {
            var re = eval(serialize(/^asdf$/gi));
            expect(re).to.be.a('RegExp');
            expect(re.global).to.equal(true);
            expect(re.ignoreCase).to.equal(true);
            expect(re.multiline).to.equal(false);
        });

        it('should serialize regexps with escaped chars', function () {
            expect(serialize(/\..*/)).to.equal('new RegExp("\\\\..*", "")');
            expect(serialize(new RegExp('\\..*'))).to.equal('new RegExp("\\\\..*", "")');
        });

        it('should deserialize regexps with escaped chars', function () {
            var re = eval(serialize(/\..*/));
            expect(re).to.be.a('RegExp');
            expect(re.source).to.equal('\\..*');
            re = eval(serialize(new RegExp('\\..*')));
            expect(re).to.be.a('RegExp');
            expect(re.source).to.equal('\\..*');
        });

        it('should serialize dangerous regexps', function () {
            var re = /[<\/script><script>alert('xss')\/\/]/
            expect(serialize(re)).to.be.a('string').equal('new RegExp("[\\u003C\\\\\\u002Fscript\\u003E\\u003Cscript\\u003Ealert(\'xss\')\\\\\\u002F\\\\\\u002F]", "")');
        });
    });

    describe('dates', function () {
        it('should serialize dates', function () {
            var d = new Date('2016-04-28T22:02:17.156Z');
            expect(serialize(d)).to.be.a('string').equal('new Date("2016-04-28T22:02:17.156Z")');
            expect(serialize({t: [d]})).to.be.a('string').equal('{"t":[new Date("2016-04-28T22:02:17.156Z")]}');
        });

        it('should deserialize a date', function () {
            var d = eval(serialize(new Date('2016-04-28T22:02:17.156Z')));
            expect(d).to.be.a('Date');
            expect(d.toISOString()).to.equal('2016-04-28T22:02:17.156Z');
        });

        it('should deserialize a string that is not a valid date', function () {
            var d = eval(serialize('2016-04-28T25:02:17.156Z'));
            expect(d).to.be.a('string');
            expect(d).to.equal('2016-04-28T25:02:17.156Z');
        });

        it('should serialize dates within objects', function () {
            var d = {foo: new Date('2016-04-28T22:02:17.156Z')};
            expect(serialize(d)).to.be.a('string').equal('{"foo":new Date("2016-04-28T22:02:17.156Z")}');
            expect(serialize({t: [d]})).to.be.a('string').equal('{"t":[{"foo":new Date("2016-04-28T22:02:17.156Z")}]}');
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
            expect(serialize(m)).to.be.a('string').equal('new Map([["a",123],[new RegExp(".*", ""),456],[Infinity,789]])');
            expect(serialize({t: [m]})).to.be.a('string').equal('{"t":[new Map([["a",123],[new RegExp(".*", ""),456],[Infinity,789]])]}');
        });

        it('should deserialize a map', function () {
            var m = eval(serialize(new Map([
                ['a', 123],
                [null, 456],
                [Infinity, 789]
            ])));
            expect(m).to.be.a('Map');
            expect(m.get(null)).to.equal(456);
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
            expect(serialize(m)).to.be.a('string').equal('new Set(["a",123,new RegExp(".*", ""),Infinity])');
            expect(serialize({t: [m]})).to.be.a('string').equal('{"t":[new Set(["a",123,new RegExp(".*", ""),Infinity])]}');
        });

        it('should deserialize a set', function () {
            var m = eval(serialize(new Set([
                'a',
                123,
                null,
                Infinity
            ])));
            expect(m).to.be.a('Set');
            expect(m.has(null)).to.equal(true);
        });
    });

    describe('sparse arrays', function () {
        it('should serialize sparse arrays', function () {
            var a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            delete a[0];
            a.length = 3;
            a[5] = "wat"
            expect(serialize(a)).to.be.a('string').equal('Array.prototype.slice.call({"1":2,"2":3,"5":"wat","length":6})');
            expect(serialize({t: [a]})).to.be.a('string').equal('{"t":[Array.prototype.slice.call({"1":2,"2":3,"5":"wat","length":6})]}');
        });

        it('should deserialize a sparse array', function () {
            var a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            delete a[0];
            a.length = 3;
            a[5] = "wat"
            var b = eval(serialize(a));
            expect(b).to.be.a('Array').deep.equal([ , 2, 3, , , 'wat' ]);
        });
    });

    describe('Infinity', function () {
        it('should serialize Infinity', function () {
            expect(serialize(Infinity)).to.equal('Infinity');
            expect(serialize({t: [Infinity]})).to.be.a('string').equal('{"t":[Infinity]}');
        });

        it('should deserialize Infinity', function () {
            var d = eval(serialize(Infinity));
            expect(d).to.equal(Infinity);
        });

        it('should serialize -Infinity', function () {
            expect(serialize(-Infinity)).to.equal('-Infinity');
            expect(serialize({t: [-Infinity]})).to.be.a('string').equal('{"t":[-Infinity]}');
        });

        it('should deserialize -Infinity', function () {
            var d = eval(serialize(-Infinity));
            expect(d).to.equal(-Infinity);
        });
    });

    describe('BigInt', function () {
        it('should serialize BigInt', function () {
            var b = BigInt(9999);
            expect(serialize(b)).to.equal('BigInt("9999")');
            expect(serialize({t: [b]})).to.be.a('string').equal('{"t":[BigInt("9999")]}');
        });

        it('should serialize 0n', function () {
            var b = BigInt(0);
            expect(serialize(b)).to.equal('BigInt("0")');
            expect(serialize({t: [b]})).to.be.a('string').equal('{"t":[BigInt("0")]}');
        });

        it('should deserialize BigInt', function () {
            var d = eval(serialize(BigInt(9999)));
            expect(d).to.be.a('BigInt');
            expect(d.toString()).to.equal('9999');
        });

        it('should throw error for invalid bigint', function () {
            expect(() => serialize(BigInt('abc'))).to.throw(Error);
        });
    });

    describe('URL', function () {
        it('should serialize URL', function () {
            var u = new URL('https://x.com/')
            expect(serialize(u)).to.equal('new URL("https://x.com/")');
            expect(serialize({t: [u]})).to.be.a('string').equal('{"t":[new URL("https://x.com/")]}');
        });

        it('should deserialize URL', function () {
            var d = eval(serialize(new URL('https://x.com/')));
            expect(d).to.be.a('URL');
            expect(d.toString()).to.equal('https://x.com/');
        });
    });

    describe('XSS', function () {
        it('should encode unsafe HTML chars to Unicode', function () {
            expect(serialize('</script>')).to.equal('"\\u003C\\u002Fscript\\u003E"');
            expect(JSON.parse(serialize('</script>'))).to.equal('</script>');
            expect(eval(serialize('</script>'))).to.equal('</script>');
        });
    });

    describe('options', function () {
        it('should accept options as the second argument', function () {
            expect(serialize('foo', {})).to.equal('"foo"');
        });

        it('should accept a `space` option', function () {
            expect(serialize([1], {space: 0})).to.equal('[1]');
            expect(serialize([1], {space: ''})).to.equal('[1]');
            expect(serialize([1], {space: undefined})).to.equal('[1]');
            expect(serialize([1], {space: null})).to.equal('[1]');
            expect(serialize([1], {space: false})).to.equal('[1]');

            expect(serialize([1], {space: 1})).to.equal('[\n 1\n]');
            expect(serialize([1], {space: ' '})).to.equal('[\n 1\n]');
            expect(serialize([1], {space: 2})).to.equal('[\n  1\n]');
        });

        it('should accept a `isJSON` option', function () {
            expect(serialize('foo', {isJSON: true})).to.equal('"foo"');
            expect(serialize('foo', {isJSON: false})).to.equal('"foo"');

            function fn() { return true; }

            expect(serialize(fn)).to.equal('function fn() { return true; }');
            expect(serialize(fn, {isJSON: false})).to.equal('function fn() { return true; }');

            expect(serialize(fn, {isJSON: true})).to.equal('undefined');
            expect(serialize([1], {isJSON: true, space: 2})).to.equal('[\n  1\n]');
        });

        it('should accept a `unsafe` option', function () {
            expect(serialize('foo', {unsafe: true})).to.equal('"foo"');
            expect(serialize('foo', {unsafe: false})).to.equal('"foo"');

            function fn() { return true; }

            expect(serialize(fn)).to.equal('function fn() { return true; }');
            expect(serialize(fn, {unsafe: false})).to.equal('function fn() { return true; }');
            expect(serialize(fn, {unsafe: undefined})).to.equal('function fn() { return true; }');
            expect(serialize(fn, {unsafe: "true"})).to.equal('function fn() { return true; }');

            expect(serialize(fn, {unsafe: true})).to.equal('function fn() { return true; }');
            expect(serialize(["1"], {unsafe: false, space: 2})).to.equal('[\n  "1"\n]');
            expect(serialize(["1"], {unsafe: true, space: 2})).to.equal('[\n  "1"\n]');
            expect(serialize(["<"], {space: 2})).to.equal('[\n  "\\u003C"\n]');
            expect(serialize(["<"], {unsafe: true, space: 2})).to.equal('[\n  "<"\n]');
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
            expect(serialize(fn, { ignoreFunction: true })).to.equal('undefined');
            // case 2. Pass function(arrow) in object to serialze
            expect(serialize(obj, { ignoreFunction: true })).to.equal('{}');
            // case 3. Other features should work
            expect(serialize(obj2, { ignoreFunction: true })).to.equal(
              '{"num":123,"str":"str"}'
            );
        });
    });

    describe('backwards-compatability', function () {
        it('should accept `space` as the second argument', function () {
            expect(serialize([1], 0)).to.equal('[1]');
            expect(serialize([1], '')).to.equal('[1]');
            expect(serialize([1], undefined)).to.equal('[1]');
            expect(serialize([1], null)).to.equal('[1]');
            expect(serialize([1], false)).to.equal('[1]');

            expect(serialize([1], 1)).to.equal('[\n 1\n]');
            expect(serialize([1], ' ')).to.equal('[\n 1\n]');
            expect(serialize([1], 2)).to.equal('[\n  1\n]');
        });
    });

    describe('placeholders', function() {
        it('should not be replaced within string literals', function () {
            // Since we made the UID deterministic this should always be the placeholder
            var fakePlaceholder = '"@__R-0000000000000000-0__@';
            var serialized = serialize({bar: /1/i, foo: fakePlaceholder}, {uid: 'foo'});
            var obj = eval('(' + serialized + ')');
            expect(obj).to.be.a('Object');
            expect(obj.foo).to.be.a('String');
            expect(obj.foo).to.equal(fakePlaceholder);
        });
    });

});
