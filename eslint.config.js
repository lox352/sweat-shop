import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  /*
   * The layers, and which way they may reach: see README, "How the code is
   * laid out". The compiler writes files and the site reads them, so nothing
   * the site is built from imports it - only the scripts, and the tests.
   */
  ...[
    [['src/pattern/**'], ['compiler', 'physics', 'library', 'reading', 'projects', 'ui']],
    [['src/physics/**'], ['compiler', 'library', 'reading', 'projects', 'ui']],
    [['src/library/**'], ['compiler', 'physics', 'reading', 'projects', 'ui']],
    [['src/reading/**'], ['compiler', 'physics', 'library', 'projects', 'ui']],
    [['src/projects/**'], ['compiler', 'ui']],
    [['src/ui/**', 'src/main.tsx'], ['compiler']],
  ].map(([files, layers]) => ({
    files,
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: layers.map((layer) => ({
          group: [`**/${layer}/**`, `**/${layer}`],
          message: `This layer does not reach into ${layer}/: see README, "How the code is laid out".`,
        })),
      }],
    },
  })),
)
