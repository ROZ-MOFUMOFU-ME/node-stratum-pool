import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
    {
        files: ['lib/**/*.ts', 'test.ts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
            },
            globals: {
                global: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                BigInt: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            // tsc --noEmit is the correctness gate; eslint surfaces a few style
            // rules as warnings (the faithful conversion keeps some var/this).
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            'no-console': 'off',
            'prefer-const': 'warn',
            'no-var': 'warn',
        },
    },
    {
        ignores: ['node_modules/**', 'dist/**', '*.log', 'eslint.config.js'],
    },
    prettier,
];
