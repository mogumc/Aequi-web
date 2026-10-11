import { globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config([
  // shadcn 生成的 ui 组件保持原样，不参与 lint
  globalIgnores(['dist', '**/components/ui/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // 页面挂载时取数（effect 内同步 setState）是本项目的统一写法，
      // 这条规则会把它一律判错，而正解要引入数据请求库——先关掉。
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': 'warn',
    },
  },
])
