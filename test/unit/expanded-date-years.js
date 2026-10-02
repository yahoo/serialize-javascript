const { describe, it } = require('node:test');
const { strictEqual } = require('node:assert');
const serialize = require('../../');

describe('Dates with expanded ISO years', function () {
    for (const timestamp of [-8640000000000000, -62198755200000, 253402300800000, 8640000000000000]) {
        it('round trips timestamp ' + timestamp, function () {
            const date = new Date(timestamp);
            const decoded = eval('(' + serialize(date) + ')');
            strictEqual(decoded.getTime(), date.getTime());
            strictEqual(decoded.toISOString(), date.toISOString());
        });
    }
});
