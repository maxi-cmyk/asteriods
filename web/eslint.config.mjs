import globals from 'globals';

export default [
    { ignores: ['dist/**', 'node_modules/**', 'vendor/**', 'assets/**'] },
    {
        files: ['**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.node },
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
            'no-shadow': 'off',
            'no-redeclare': 'error',
            'no-dupe-keys': 'error',
        },
    },
];
