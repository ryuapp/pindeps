# pindeps

[![License](https://img.shields.io/github/license/ryuapp/pindeps?labelColor=171717&color=39b54a&label=License)](https://github.com/ryuapp/pindeps/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/pindeps?labelColor=171717&color=39b54a)](https://www.npmjs.com/package/pindeps)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ryuapp/pindeps)

pindeps is a CLI tool to pin dependency versions in JavaScript package managers. It parses lockfiles and pins versions in dependency files such as `package.json` and `pnpm-workspace.yaml`.

```diff
{
  "dependencies": {
-   "pindeps": "^0.2.0"
+   "pindeps": "0.3.1"
  }
}
```

## Usage

```sh
npx pindeps
```

Secure usage with Deno:

```sh
deno --no-lock -WR="." npm:pindeps
```

## Supported Package Managers

The following package managers are currently supported:

- npm
  - package.json
  - package-lock.json

- Yarn
  - package.json
  - yarn.lock

- pnpm
  - package.json
  - pnpm-workspace.yaml
  - pnpm-lock.yaml

- Bun
  - package.json
  - bun.lock

- Deno
  - package.json
  - deno.json(c)
  - deno.lock

## Feedback

Found a bug or have an idea for a new feature? [Please fill out an issue](https://github.com/ryuapp/pindeps/issues/new).

## Related

- [Should you Pin your JavaScript Dependencies?](https://docs.renovatebot.com/dependency-pinning/) - Renovate Docs provides a comprehensive explanation of dependency pinning.

- [pinact](https://github.com/suzuki-shunsuke/pinact) by [Shunsuke Suzuki](https://github.com/suzuki-shunsuke) - A CLI tool to pin versions of GitHub Actions and Reusable Workflows.
