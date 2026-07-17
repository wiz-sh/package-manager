import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const sourceRoot = resolve(import.meta.dir, "../src");

test("package-manager source folders contain multiple modules", async () => {
    const entries = await readdir(sourceRoot, {
        withFileTypes: true,
    });

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const children = await readdir(resolve(sourceRoot, entry.name), {
            withFileTypes: true,
        });

        const modules = children.filter((child) => {
            return child.isFile() && child.name.endsWith(".ts");
        });

        expect(
            modules.length,
            `packages/pm/src/${entry.name} contains only ${modules.length} modules`,
        ).toBeGreaterThanOrEqual(2);
    }
});
