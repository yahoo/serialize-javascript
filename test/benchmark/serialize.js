'use strict';

var Benchmark = require('benchmark'),
    serialize = require('../../');

var suiteConfig = {
    onStart: function (e) {
        console.log(e.currentTarget.name + ':');
    },

    onCycle: function (e) {
        console.log(String(e.target));
    },

    onComplete: function () {
        console.log('');
    }
};

// -- simpleOjb ----------------------------------------------------------------

var simpleObj = {
    foo: 'foo',
    bar: false,
    num: 100,
    arr: [1, 2, 3, 4],
    obj: {baz: 'baz'}
};

new Benchmark.Suite('simpleObj', suiteConfig)
    .add('JSON.stringify( simpleObj )', function () {
        JSON.stringify(simpleObj);
    })
    .add('serialize( simpleObj )', function () {
        serialize(simpleObj);
    })
    .run();
