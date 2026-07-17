import { afterEach, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { temporaryDirectory } from "../../../../tests/utils/filesystem.ts";
import { manifest } from "../../../../tests/utils/fixtures.ts";
import { createRepository, gitCommand } from "../../../../tests/utils/git.ts";
import { indexPath } from "../../../runtime/src/execution.ts";
import { doctor, verifyCache, why } from "../../src/commands/maintenance.ts";
import {
    addRegistry,
    approve,
    install,
    list,
    prune,
    remove,
    update,
} from "../../src/commands.ts";
import { readLockfile } from "../../src/project/lockfile.ts";
import { readManifest } from "../../src/project/manifest.ts";

const roots: string[] = [];
const originalCwd = process.cwd();
const originalHome = process.env.WIZ_HOME;
const originalRegistry = process.env.WIZ_REGISTRY;

async function createTestRoot(): Promise<string> {
    const root = await temporaryDirectory();

    roots.push(root);

    return root;
}

async function createProject(root: string, source: string): Promise<string> {
    const project = join(root, "project");

    await mkdir(project);

    await writeFile(join(project, "manifest.json"), source);

    return project;
}

function enterProject(root: string, project: string): void {
    process.env.WIZ_HOME = join(root, "wiz-home");

    process.chdir(project);
}

afterEach(async () => {
    process.chdir(originalCwd);

    if (originalHome === undefined) {
        delete process.env.WIZ_HOME;
    } else {
        process.env.WIZ_HOME = originalHome;
    }

    if (originalRegistry === undefined) {
        delete process.env.WIZ_REGISTRY;
    } else {
        process.env.WIZ_REGISTRY = originalRegistry;
    }

    for (const root of roots.splice(0)) {
        await rm(root, { recursive: true, force: true });
    }
});

test("commands install, list, update, prune and remove", async () => {
    const root = await createTestRoot();

    const dep = join(root, "dep");

    await createRepository(
        dep,
        manifest("dep", {
            package: {
                index: "index.sh",
            },
        }),
        {
            "index.sh": "VALUE=1\n",
        },
    );

    const project = await createProject(
        root,
        manifest("project", {
            dependencies: {
                dep: {
                    repo: dep,
                    branch: "main",
                },
            },
        }),
    );

    enterProject(root, project);

    await install(false);

    const installedPackages = await list(false);

    const dependencyIndex = await indexPath("dep", false);

    expect(installedPackages).toHaveLength(1);

    expect(dependencyIndex).toBe("wiz_modules/dep/index.sh");

    expect(await why("dep")).toContain("project -> dep");

    expect(await doctor()).toEqual(
        expect.arrayContaining(["ok manifest project", "ok installed dep"]),
    );

    expect(await verifyCache()).toEqual([expect.stringMatching(/^ok dep@/)]);

    await install(true);

    await update("dep");

    await mkdir(join(project, "wiz_modules", "stale"));

    const prunedPackages = await prune(false, false);

    expect(prunedPackages).toEqual(["stale"]);

    await remove("dep");

    const remainingPackages = await list(false);

    const savedManifest = await readManifest(project);

    expect(remainingPackages).toEqual([]);

    expect(savedManifest.dependencies).toEqual({});
});

test("frozen installs reject absent and stale lockfiles", async () => {
    const root = await createTestRoot();

    await writeFile(join(root, "manifest.json"), manifest("project"));

    enterProject(root, root);

    expect(install(true)).rejects.toThrow("requires");

    await install(false);

    const staleManifest = manifest("project", {
        dependencies: {
            missing: {
                repo: "./missing",
            },
        },
    });

    await writeFile(join(root, "manifest.json"), staleManifest);

    expect(install(true)).rejects.toThrow("differ");
});

test("official type packages install from the bundled catalog offline", async () => {
    const root = await createTestRoot();

    const project = await createProject(root, manifest("project"));

    enterProject(root, project);

    // Any accidental registry resolution fails immediately instead of using the network.
    process.env.WIZ_REGISTRY = "http://127.0.0.1:1";

    const name = await addRegistry({ name: "@types/common" });

    const savedManifest = await readManifest(project);

    const lockfile = await readLockfile(project);

    const installedIndex = join(
        project,
        "wiz_modules",
        "@types",
        "common",
        "index.d.wiz",
    );

    expect(name).toBe("@types/common");

    expect(savedManifest.dependencies[name]).toEqual({ builtin: "types" });

    expect(lockfile?.packages[0]?.source).toEqual(
        expect.objectContaining({
            type: "builtin",
            package: "@types/common",
        }),
    );

    expect(await Bun.file(installedIndex).exists()).toBe(true);

    await install(true);
});

test("isolates incompatible transitive revisions of the same package", async () => {
    const root = await createTestRoot();

    const sharedA = join(root, "shared-a");

    const sharedB = join(root, "shared-b");

    await createRepository(sharedA, manifest("shared"), {
        "value.txt": "a",
    });

    await createRepository(sharedB, manifest("shared"), {
        "value.txt": "b",
    });

    const parentA = join(root, "parent-a");

    const parentB = join(root, "parent-b");

    await createRepository(
        parentA,
        manifest("parent-a", {
            dependencies: {
                shared: {
                    repo: sharedA,
                },
            },
        }),
    );

    await createRepository(
        parentB,
        manifest("parent-b", {
            dependencies: {
                shared: {
                    repo: sharedB,
                },
            },
        }),
    );

    const project = await createProject(
        root,
        manifest("project", {
            dependencies: {
                "parent-a": {
                    repo: parentA,
                },
                "parent-b": {
                    repo: parentB,
                },
            },
        }),
    );

    enterProject(root, project);

    await install(false);

    const lockfile = await readLockfile(project);

    const sharedPackages = lockfile?.packages.filter((item) => {
        return item.name === "shared";
    });

    const parentAValuePath = join(
        project,
        "wiz_modules",
        "parent-a",
        "wiz_modules",
        "shared",
        "value.txt",
    );

    const parentBValuePath = join(
        project,
        "wiz_modules",
        "parent-b",
        "wiz_modules",
        "shared",
        "value.txt",
    );

    const parentAValue = await readFile(parentAValuePath, "utf8");

    const parentBValue = await readFile(parentBValuePath, "utf8");

    expect(sharedPackages).toHaveLength(2);

    expect(parentAValue).toBe("a");

    expect(parentBValue).toBe("b");
});

test("postinstall scripts require exact locked approval", async () => {
    const root = await createTestRoot();

    const dependency = join(root, "dependency");

    await createRepository(
        dependency,
        manifest("builder", {
            scripts: {
                postinstall: "printf built > generated.txt",
            },
        }),
    );

    const project = await createProject(
        root,
        manifest("project", {
            dependencies: {
                builder: {
                    repo: dependency,
                },
            },
        }),
    );

    const generatedProjectFile = join(
        project,
        "wiz_modules",
        "builder",
        "generated.txt",
    );

    const generatedSourceFile = join(dependency, "generated.txt");

    enterProject(root, project);

    await install(false);

    const generatedBeforeApproval =
        await Bun.file(generatedProjectFile).exists();

    const pendingApprovals = await approve([]);

    expect(generatedBeforeApproval).toBe(false);

    expect(pendingApprovals).toHaveLength(1);

    const approvedPackages = await approve(["builder"]);

    const generatedContents = await readFile(generatedProjectFile, "utf8");

    const sourceWasMutated = await Bun.file(generatedSourceFile).exists();

    expect(approvedPackages).toHaveLength(1);

    expect(generatedContents).toBe("built");

    expect(sourceWasMutated).toBe(false);

    await writeFile(join(dependency, "revision.txt"), "new revision");

    await gitCommand(dependency, ["add", "."]);

    await gitCommand(dependency, ["commit", "-m", "advance dependency"]);

    await update("builder");

    const generatedAfterUpdate = await Bun.file(generatedProjectFile).exists();

    const pendingAfterUpdate = await approve([]);

    expect(generatedAfterUpdate).toBe(false);

    expect(pendingAfterUpdate).toHaveLength(1);
});
