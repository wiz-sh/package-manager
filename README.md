# Wiz package manager and runtime

This repository owns dependency materialization and executable runtime behavior for Wiz projects.

Published packages:

- [`@wiz-sh/pm`](https://www.npmjs.com/package/@wiz-sh/pm) manages manifests, lockfiles, registry/Git/local/workspace dependency resolution, stores, installation, linking, approvals, and path security.
- [`@wiz-sh/runtime`](https://www.npmjs.com/package/@wiz-sh/runtime) resolves executables and runs scripts, temporary package commands, and child processes with correct environment, arguments, signals, and exit codes.

The boundary is intentional: runtime may consume package-manager APIs, while package management does not depend on runtime execution.

## Dependency sources

Wiz supports registry ranges, pinned Git revisions, local paths, and monorepo workspaces in one project. Lockfile records are source-specific and never contain registry tokens, cookies, presigned URLs, or embedded Git credentials.

```json
{
    "dependencies": {
        "@scope/tool": "^1.2.0",
        "git-helper": {
            "git": "https://github.com/example/helper.git",
            "rev": "4f92820abc"
        },
        "local-helper": {
            "path": "../local-helper"
        }
    }
}
```

Archive extraction, package paths, manifests, and traversal boundaries are validated before materialization.

## Development

Keep the registry repository beside this checkout, then run:

```console
bun install
bun run check
bun run build
```

Tests preserve legacy Git workflows while covering manifests, lockfile migrations, semantic version selection, registry integrity, local and workspace sources, executable lookup, argument forwarding, signals, and exit codes on Linux and macOS.

The CLI commands are assembled in [`wiz-sh/wiz`](https://github.com/wiz-sh/wiz). Licensed under [MIT](LICENSE).
