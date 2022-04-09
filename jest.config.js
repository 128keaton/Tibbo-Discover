module.exports = {
    transform: {
        '^.+\\.tsx?$': 'ts-jest'
    },
    coverageDirectory: 'test/coverage',
    testRegex: '/test/tibbo.test.ts',
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'ts'],
};
