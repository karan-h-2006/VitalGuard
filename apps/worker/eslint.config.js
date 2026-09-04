import node from '@vitalguard/config/eslint/node';

export default [
  ...node,
  {
    ignores: ['dist/**'],
  },
];
