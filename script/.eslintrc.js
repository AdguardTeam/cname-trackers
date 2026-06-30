module.exports = {
    env: {
        node: true,
        commonjs: true,
        es2021: true,
    },
    extends: [
        'airbnb-base',
    ],
    parserOptions: {
        ecmaVersion: 12,
    },
    rules: {
        indent: ['error', 4, {
            SwitchCase: 1,
        }],
        'no-console': 'off',
        'import/no-extraneous-dependencies': 'off',
        // Node 22 supports the `node:` protocol for built-in modules
        // (e.g. `require('node:test')`); eslint-plugin-import 2.x can't resolve
        // them, so ignore the `node:` scheme in resolution checks.
        'import/no-unresolved': ['error', {
            commonjs: true,
            caseSensitive: true,
            ignore: ['^node:'],
        }],
        'max-len': ['error', {
            code: 120,
            comments: 120,
            tabWidth: 4,
            ignoreUrls: false,
            ignoreTrailingComments: false,
            ignoreComments: false,
        }],
    },
};
