/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.ts'],
    moduleNameMapper: {
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@canvas/(.*)$': '<rootDir>/src/canvas/$1',
        '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
        '^@layout/(.*)$': '<rootDir>/src/layout/$1',
        '^@nodes/(.*)$': '<rootDir>/src/nodes/$1',
        '^@export/(.*)$': '<rootDir>/src/export/$1',
        '^@webview/(.*)$': '<rootDir>/src/webview/$1',
        '^@commands/(.*)$': '<rootDir>/src/commands/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@types/(.*)$': '<rootDir>/src/types/$1',
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/webview/**/*.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },
    verbose: true,
    clearMocks: true,
    restoreMocks: true,
};
