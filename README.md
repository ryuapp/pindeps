# pindeps

[![License](https://img.shields.io/github/license/ryuapp/pindeps?labelColor=171717&color=39b54a&label=License)](https://github.com/ryuapp/pindeps/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/pindeps?labelColor=171717&color=39b54a)](https://www.npmjs.com/package/pindeps)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ryuapp/pindeps)

pindeps is a CLI to pin versions of JavaScript package managers' dependencies, such as `package.json`. pindeps parses lockfiles to pin versions.

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

# Deno
deno -WR="./" npm:pindeps
```

## Roadmap

This CLI currently supports `package.json` and `pnpm-workspace.yaml`, but the support is unstable.

### Package management files support

- [x] package.json (dependencies, devDependencies)
- [x] pnpm-workspace.yaml (catalog, catalogs)
- [ ] deno.json(c)

### Lockfiles support

- [x] package-lock.json (npm)
- [x] yarn.lock (Yarn)
- [x] pnpm-lock.yaml (pnpm)
- [x] bun.lock (Bun)
- [x] deno.lock (Deno)

## Feedback

Find a bug or have an idea for a new feature? [Please fill out an issue](https://github.com/ryuapp/pindeps/issues/new).

## Related

- [Should you Pin your JavaScript Dependencies?](https://docs.renovatebot.com/dependency-pinning/) - Renovate Docs has a good explanation about pinning dependencies.

- [pinact](https://github.com/suzuki-shunsuke/pinact) by [Shunsuke Suzuki](https://github.com/suzuki-shunsuke) - A CLI to pin versions of Actions and Reusable Workflows.
