import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { afterEach, beforeAll, expect, it } from "vitest";
import { appFolder, cleanup } from "#test/cli.ts";
import { packTemplate } from "./packTemplate.ts";

beforeAll(() =>
	Effect.runPromise(
		packTemplate(
			fileURLToPath(new URL("../../../examples/starter", import.meta.url)),
			fileURLToPath(new URL("../template.json", import.meta.url)),
		).pipe(Effect.provide(NodeServices.layer)),
	),
);
afterEach(cleanup);

it("runs setup after Git initialization and installs the active Quality gate before the initial commit", () => {
	const { root, run } = appFolder({ realSetup: true });
	const result = run(["my-app"]);
	expect(result.status, result.stdout + result.stderr).toBe(0);
	const app = join(root, "my-app");
	expect(readFileSync(join(app, ".git/hooks/pre-commit"), "utf8")).toContain("Installed by @shivaedev/quality");
	const setup = JSON.parse(readFileSync(join(app, ".git/setup-order.json"), "utf8"));
	expect(setup.head).not.toBe(0);
	expect(setup.staged).toBe("");
	const gate = JSON.parse(readFileSync(join(app, ".git/initial-gate.json"), "utf8"));
	expect(gate.staged.split("\n")).toEqual(expect.arrayContaining(["package.json", "pnpm-lock.yaml", "src/setup.ts"]));
	expect(spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: app, encoding: "utf8" }).stdout).toBe("1\n");
});

it("leaves the initial commit blocked when the installed Quality gate fails", () => {
	const { root, run } = appFolder({ realSetup: true, typecheckExit: 7 });
	const result = run(["my-app"]);
	expect(result.status, result.stdout + result.stderr).toBe(1);
	const app = join(root, "my-app");
	expect(existsSync(join(app, ".git/hooks/pre-commit"))).toBe(true);
	expect(existsSync(join(app, ".git/initial-gate.json"))).toBe(true);
	expect(result.stderr).toContain("commit -m Initialize a generated app failed");
	expect(spawnSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: app }).status).not.toBe(0);
});

it("runs setup without installing a hook when a repository encloses the app", () => {
	const { root, run } = appFolder({ realSetup: true });
	expect(spawnSync("git", ["init", "--quiet"], { cwd: root }).status).toBe(0);
	const result = run(["my-app"]);
	expect(result.status, result.stdout + result.stderr).toBe(0);
	expect(existsSync(join(root, "my-app/node_modules"))).toBe(true);
	expect(existsSync(join(root, "my-app/.git"))).toBe(false);
	expect(existsSync(join(root, ".git/hooks/pre-commit"))).toBe(false);
});
