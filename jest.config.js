module.exports = {
    transform: {
        '^.+\\.tsx?$': 'ts-jest'
    },
    coverageDirectory: 'test/coverage',
    testRegex: '\\/test\\/.*.ts$',
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'ts'],
    collectCoverageFrom: [
        "dist/**.js",
        "!dist/index.js"
    ],
};
