import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist.bak-appeals', '**/*.bak-appeals']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Ловит TDZ-обращения к const/let до их объявления (как краш ProductDetailPage,
      // где stockGatingActive читал orderedOptionKeys до инициализации). Функции и
      // классы не трогаем — они поднимаются и используются раньше объявления штатно.
      'no-use-before-define': ['error', { functions: false, classes: false, variables: true }],
      // Понижено до предупреждения (в reactRefresh.configs.vite это error).
      // Правило про удобство разработки — при экспорте не-компонента рядом с
      // компонентом Vite не может сделать точечный fast refresh и перезагружает
      // модуль целиком. Но живого бага в этом нет, а срабатывает оно на
      // совершенно обычном для React способе класть провайдер и его хук в один
      // файл (auth/index.jsx: AuthProvider + useAuth, contexts/CartContext.jsx:
      // CartProvider + useCart). Раскладывать их по файлам ради fast refresh —
      // правка на десятки импортов; линт же в CI теперь блокирующий, и падать он
      // должен на ошибках, а не на этом.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
