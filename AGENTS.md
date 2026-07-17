# Working on Wiz package manager

Read `WIZ.md` for the product model before changing public behavior.

## Ownership

This repository owns `@wiz-sh/pm` and `@wiz-sh/runtime`. Package resolution, manifests, lockfiles, stores, workspaces, and installation belong to PM. Executable resolution and process behavior belong to runtime. PM must never depend on runtime.

## Engineering rules

- Use Bun for installs, scripts, builds, runtime, and tests.
- Keep TypeScript strict and ESNext.
- Use four spaces, double quotes, semicolons, and spacious control flow.
- Comments should explain an invariant, tradeoff, compatibility constraint, or non-obvious reason.
- Add JSDoc to stable public APIs when the contract is not obvious from the signature.
- Classes are welcome when identity, lifecycle, state, or invariants make them clearer.
- Do not create empty directories or one-file directory hierarchies without a real ownership boundary.
- Do not commit generated `dist` output.
- Preserve shell quoting, argument order, exit status, signals, and source locations.

## Verification

Run the narrowest relevant test while editing, then run:

```console
bun run format:check
bun run lint
bun run typecheck
bun test
bun run build
```

Cross-product CLI and end-to-end workflows live in the `wiz-sh/wiz` integration repository. Component tests in this repository must remain independently runnable.
