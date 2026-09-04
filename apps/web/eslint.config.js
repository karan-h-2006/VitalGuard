import react from '@vitalguard/config/eslint/react';

export default [
  ...react,
  {
    ignores: ['dist/**'],
  },
];
