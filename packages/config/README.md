# @vitalguard/config

Shared ESLint, Prettier, and TypeScript compiler options. Every app and
package in this repo **extends** these files rather than duplicating them.

## What lives here

| Export                                   | Purpose                                  |
| ---------------------------------------- | ---------------------------------------- |
| `@vitalguard/config/tsconfig/base.json`  | Strict TS flags shared by everything     |
| `@vitalguard/config/tsconfig/node.json`  | NodeNext module settings for API/worker  |
| `@vitalguard/config/tsconfig/react.json` | Bundler + JSX settings for the web app   |
| `@vitalguard/config/eslint/node`         | ESLint flat config + Node globals        |
| `@vitalguard/config/eslint/react`        | ESLint flat config + browser/React hooks |
| `@vitalguard/config/prettier`            | Prettier options                         |

## Usage

In a workspace `tsconfig.json`:

```json
{
  "extends": "@vitalguard/config/tsconfig/node.json"
}
```

This package has no runtime build. Change a rule here, and every consumer
picks it up on the next `pnpm lint` / `pnpm typecheck`.
