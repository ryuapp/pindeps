# pindeps

[![License](https://img.shields.io/github/license/ryuapp/pindeps?labelColor=171717&color=39b54a&label=License)](https://github.com/ryuapp/pindeps/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/pindeps?labelColor=171717&color=39b54a)](https://www.npmjs.com/package/pindeps)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ryuapp/pindeps)

pindeps is a CLI tool to pin dependency versions in JavaScript package managers.\
It parses lockfiles and pins versions in dependency files such as `package.json` and `pnpm-workspace.yaml`.

```diff
{
  "dependencies": {
-   "pindeps": "^0.2.0"
+   "pindeps": "0.3.1"
  }
}
```

## Usage

You can pin dependencies in your `package.json`, `pnpm-workspace.yaml`, and `deno.json(c)` by using the following command:

```sh
npx pindeps@latest

# Other package managers
yarn dlx pindeps
pnpm dlx pindeps
bunx pindeps@latest

# Secure usage with Deno (v2.6.0 or higher):
dx -rWR="." pindeps
```

### `--dev` flag

If you want to pin only `devDependencies`, you can use `--dev` flag:

```sh
npx pindeps@latest --dev
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
