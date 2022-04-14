module.exports = {
    transform: {
        '^.+\\.tsx?$': 'ts-jest'
    },
    coverageDirectory: 'test/coverage',
    testRegex: [
        '/test/tibbo-helpers.test.ts',
        '/test/tibbo-discover.test.ts'
    ],
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'ts'],
    collectCoverageFrom: [
        "dist/**.js",
        "!dist/index.js"
    ],
};
