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
    });

    describe('regexps', function () {
        it('should serialize constructed regexps', function () {
            var re = new RegExp('asdf');
            expect(serialize(re)).to.be.a('string').equal('/asdf/');
        });

        it('should deserialize constructed regexps', function () {
            var re = eval(serialize(new RegExp('asdf')));
            expect(re).to.be.a('RegExp');
            expect(re.source).to.equal('asdf');
        });

        it('should serialize literal regexps', function () {
            var re = /asdf/;
            expect(serialize(re)).to.be.a('string').equal('/asdf/');
        });

        it('should deserialize literal regexps', function () {
            var re = eval(serialize(/asdf/));
            expect(re).to.be.a('RegExp');
            expect(re.source).to.equal('asdf');
        });

        it('should serialize regexps with flags', function () {
            var re = /^asdf$/gi;
            expect(serialize(re)).to.equal('/^asdf$/gi');
        });

        it('should deserialize regexps with flags', function () {
            var re = eval(serialize(/^asdf$/gi));
            expect(re).to.be.a('RegExp');
            expect(re.global).to.equal(true);
            expect(re.ignoreCase).to.equal(true);
            expect(re.multiline).to.equal(false);
        });

        it('should serialize regexps with escaped chars', function () {
            expect(serialize(/\..*/)).to.equal('/\\..*/');
            expect(serialize(new RegExp('\\..*'))).to.equal('/\\..*/');
        });

        it('should deserialize regexps with escaped chars', function () {
            var re = eval(serialize(/\..*/));
            expect(re).to.be.a('RegExp');
            expect(re.source).to.equal('\\..*');
            re = eval(serialize(new RegExp('\\..*')));
            expect(re).to.be.a('RegExp');
            expect(re.source).to.equal('\\..*');
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
});
