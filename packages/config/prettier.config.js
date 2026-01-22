/** @type {import("prettier").Config} */
const config = {
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'es5',
    printWidth: 100,
    bracketSpacing: true,
    arrowParens: 'always',
    endOfLine: 'lf',

    // Tailwind CSS plugin ordering (if used)
    plugins: [],

    overrides: [
        {
            files: '*.json',
            options: {
                tabWidth: 2,
            },
        },
        {
            files: '*.md',
            options: {
                proseWrap: 'preserve',
            },
        },
    ],
};

export default config;
