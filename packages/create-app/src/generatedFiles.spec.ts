import { lstatSync, readdirSync, readFileSync, readlinkSync, statSync } from "node:fs";
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

it("gives a generated app its own guidance, documentation, names and normal file permissions", () => {
	const { root, run } = appFolder();
	const result = run(["demo", "--no-git"], ["NODE_OPTIONS=--import=data:text/javascript,process.umask(0o077)"]);
	expect(result.status, result.stdout + result.stderr).toBe(0);
	const app = join(root, "demo");
	function read(path: string) {
		return readFileSync(join(app, path), "utf8");
	}
	expect(read("README.md")).toMatch(/^# demo\n/u);
	for (const path of ["README.md", "AGENTS.md"]) {
		expect(read(path)).not.toMatch(/starter|create-app|check:published|--registry|published-versions/iu);
		expect(read(path)).toContain("pnpm dev");
		expect(read(path)).toContain("pnpm test");
		expect(read(path)).toContain("docs/framework/");
	}
	for (const command of ["pnpm run setup", "pnpm build", "pnpm migrate", "pnpm start", "pnpm worker"]) {
		expect(read("README.md")).toContain(command);
	}
	expect(lstatSync(join(app, "CLAUDE.md")).isSymbolicLink()).toBe(true);
	expect(readlinkSync(join(app, "CLAUDE.md"))).toBe("AGENTS.md");
	expect(read(".env.example")).toContain("/demo_dev\n");
	expect(read(".env.example")).toContain("/demo_test\n");
	expect(readdirSync(app)).not.toContain("published-versions.json");
	for (const path of readdirSync(app, { recursive: true, withFileTypes: true })) {
		if (path.isDirectory() || path.isSymbolicLink() || path.name === "installation.json") {
			continue;
		}
		const file = join(path.parentPath, path.name);
		expect(file).not.toMatch(/starter/iu);
		expect(readFileSync(file, "utf8"), file).not.toMatch(/starter/iu);
		expect(statSync(file).mode & 0o777, file).toBe(path.name === ".env.local" ? 0o600 : 0o644);
	}
	for (const path of JSON.parse(read("tsconfig.json")).include) {
		expect(() => statSync(join(app, path)), path).not.toThrow();
	}
});
