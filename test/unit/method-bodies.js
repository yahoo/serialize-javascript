const { describe, it } = require('node:test');
const { strictEqual } = require('node:assert');
const serialize = require('../../');

describe('method bodies containing other functions', function () {
    it('round trips a method containing an arrow with destructured parameters', function () {
        const input = {
            method() {
                const nested = ({ value }) => value;
                return nested({ value: 42 });
            }
        };
        const output = eval('(' + serialize(input) + ')');
        strictEqual(output.method(), 42);
    });

    it('round trips a method containing a function declaration', function () {
        const input = {
            method() {
                function nested() { return 42; }
                return nested();
            }
        };
        const output = eval('(' + serialize(input) + ')');
        strictEqual(output.method(), 42);
    });

    it('preserves async methods containing arrows', async function () {
        const input = {
            async method() {
                const nested = () => 42;
                return nested();
            }
        };
        const output = eval('(' + serialize(input) + ')');
        strictEqual(await output.method(), 42);
    });

    it('preserves generator methods containing arrows', function () {
        const input = {
            *method() {
                const nested = () => 42;
                yield nested();
            }
        };
        const output = eval('(' + serialize(input) + ')');
        strictEqual(output.method().next().value, 42);
    });
});


describe('outer function signatures', function () {
    it('preserves async signatures with comments instead of spaces', async function () {
        for (const fn of [async/**/function () { return 42; }, async/**/() => 42]) {
            const output = eval('(' + serialize(fn) + ')');
            strictEqual(await output(), 42);
            strictEqual(output.constructor.name, 'AsyncFunction');
        }
    });

    it('preserves arrows whose default arguments contain functions', function () {
        const fn = (callback = function () { return 42; }) => callback();
        const output = eval('(' + serialize(fn) + ')');
        strictEqual(output(), 42);
    });
});
