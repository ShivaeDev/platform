import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { afterEach, beforeAll, expect, it } from "vitest";
import { appFolder, cleanup } from "#test/cli.ts";
import { packTemplate } from "./packTemplate.ts";

const version: unknown = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

beforeAll(() =>
	Effect.runPromise(
		packTemplate(
			fileURLToPath(new URL("../../../examples/starter", import.meta.url)),
			fileURLToPath(new URL("../template.json", import.meta.url)),
		).pipe(Effect.provide(NodeServices.layer)),
	),
);
afterEach(cleanup);

it("creates a named app in a new parent path, installs, and prints the environment and development steps", () => {
	const { root, run } = appFolder();
	const result = run(["apps/my-app"]);
	expect(result.status).toBe(0);
	const app = join(root, "apps/my-app");
	expect(JSON.parse(readFileSync(join(app, "package.json"), "utf8"))).toMatchObject({ name: "my-app" });
	expect(readFileSync(join(app, "installation.json"), "utf8")).toBe('["install"]');
	for (const step of [
		"Created apps/my-app.",
		"cd 'apps/my-app'",
		"cp .env.example .env.local",
		"DATABASE_URL",
		"BETTER_AUTH_SECRET",
		"32 characters",
		"pnpm dev",
	]) {
		expect(result.stdout).toContain(step);
	}
});

it("prints a working cd command for parent paths with shell characters", () => {
	const { root, run } = appFolder();
	const folder = "parent 'quoted' $literal/my-app";
	const result = run([folder]);
	expect(result.status).toBe(0);
	const cd = result.stdout.split("\n").find((line) => line.trimStart().startsWith("cd "));
	expect(cd).toBeDefined();
	const navigation = spawnSync("sh", ["-c", `${cd}\npwd`], { cwd: root, encoding: "utf8" });
	expect(navigation.status).toBe(0);
	expect(navigation.stdout.trim()).toBe(join(root, folder));
});

it("accepts an existing empty folder", () => {
	const { root, run } = appFolder({ destination: "empty" });
	expect(run(["my-app"]).status).toBe(0);
	expect(existsSync(join(root, "my-app/src/notes.ts"))).toBe(true);
});

it("refuses existing files and nonempty folders including hidden files without writing or installing", () => {
	for (const kind of ["file", "nonempty"] as const) {
		const { root, run } = appFolder({ destination: kind });
		const target = join(root, "my-app");
		const existing = kind === "nonempty" ? join(target, ".keep") : target;
		const result = run(["my-app"]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("the destination must be an empty folder");
		expect(readFileSync(existing, "utf8")).toBe("user data");
		if (kind === "nonempty") {
			expect(readdirSync(target)).toEqual([".keep"]);
		}
	}
});

it("reports installation failure and leaves the generated app available for retry", () => {
	const { root, run } = appFolder({ installationExit: 7 });
	const result = run(["my-app"]);
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("pnpm install failed (exit 7)");
	expect(result.stderr).toContain("Run pnpm install in my-app to retry");
	expect(result.stdout).not.toContain("Next steps");
	expect(existsSync(join(root, "my-app/package.json"))).toBe(true);
});

it("rejects invalid package names before creating a folder", () => {
	const { root, run } = appFolder();
	for (const name of ["Bad Name", "node_modules", "favicon.ico"]) {
		expect(run([name]).status).toBe(1);
		expect(existsSync(join(root, name))).toBe(false);
	}
});

it("provides help and reports the package version without generating an app", () => {
	const { root, run } = appFolder();
	expect(run(["--help"])).toMatchObject({ status: 0 });
	expect(run(["--help"]).stdout).toContain("folder");
	expect(run(["--version"])).toMatchObject({ status: 0, stdout: `create-app v${version}\n` });
	expect(readdirSync(root)).toEqual(["bin"]);
});
