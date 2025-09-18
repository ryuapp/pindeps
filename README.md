# Pindeps

pindeps is a tool to pin versions of dependencies in `package.json` and other files. It's inspired by [pinact](https://github.com/suzuki-shunsuke/pinact).

```sh
npx pindeps
```

## Roadmap

This library currently only supports `package.json`, but the support is unstable.
Our immediate goal is to fully support latest npm/Yarn/pnpm/Bun/Deno lock files and fully pin `package.json` dependencies.

### Package management files support

- [ ] package.json
- [ ] pnpm-workspace.yaml
- [ ] deno.json(c)

### Lock files support

- [ ] package-lock.json (npm)
- [ ] yarn.lock (Yarn)
- [ ] pnpm-lock.yaml (pnpm)
- [ ] bun.lock (Bun)
- [ ] deno.lock (Deno)
