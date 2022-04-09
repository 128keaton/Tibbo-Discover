module.exports = {
    transform: {
        '^.+\\.tsx?$': 'ts-jest'
    },
    coverageDirectory: 'test/coverage',
    testRegex: '/test/tibbo-discover.test.ts',
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'ts'],
};
