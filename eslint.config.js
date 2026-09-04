import node from '@vitalguard/config/eslint/node';
import react from '@vitalguard/config/eslint/react';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      'simulator/**',
      'infra/**',
      'apps/web/dist/**',
    ],
  },
  ...node,
  ...react,
];
