import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WizError } from "../utils/errors.ts";

const packages = new Map<string, string>([
    ["@types/agents", "agents"],
    ["@types/cloud", "cloud"],
    ["@types/common", "common"],
    ["@types/compilers", "compilers"],
    ["@types/coreutils", "coreutils"],
    ["@types/db", "db"],
    ["@types/developer", "developer"],
    ["@types/disk", "disk"],
    ["@types/github", "github"],
    ["@types/js", "js"],
    ["@types/network", "network"],
    ["@types/nix", "nix"],
    ["@types/python", "python"],
    ["@types/security", "security"],
    ["@types/shell", "shell"],
    ["@types/system", "system"],
    ["@types/wiz", "wiz"],
]);

export function isOfficialTypeSpecifier(name: string): boolean {
    return name.startsWith("@types/");
}

/** Resolves an official declaration package from Wiz's installed local catalog. */
export function officialTypePackageRoot(name: string): string {
    const directory = packages.get(name);

    if (directory === undefined) {
        throw new WizError(`Unknown bundled type package: ${name}`);
    }

    const manifest = import.meta.resolve(
        `@wiz-sh/types/${directory}/manifest.json`,
    );

    return dirname(fileURLToPath(manifest));
}
