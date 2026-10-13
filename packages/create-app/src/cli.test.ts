import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { afterEach, beforeAll, expect, it } from "vitest";
import { appFolder, cleanup, testEnvironment } from "#test/cli.ts";
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

it("creates a named app in a new parent path, installs, and prints only navigation and development steps", () => {
	const { root, run } = appFolder();
	const result = run(["apps/my-app"]);
	expect(result.status).toBe(0);
	const app = join(root, "apps/my-app");
	expect(JSON.parse(readFileSync(join(app, "package.json"), "utf8"))).toMatchObject({ name: "my-app" });
	expect(readFileSync(join(app, "package.json"), "utf8")).toMatch(/^\{\n\t"name": "my-app",/u);
	expect(readFileSync(join(app, "installation.json"), "utf8")).toBe('["install"]');
	expect(result.stdout).toBe("Created apps/my-app.\n\nNext steps:\n  cd 'apps/my-app'\n  pnpm dev\n");
});

it("writes app-specific local database URLs and a fresh secret on every run, ignored by Git", () => {
	const { root, run } = appFolder();
	const secrets = new Set<string>();
	for (const [name, database] of [
		["my-app", "my_app"],
		["2.app", "app_2_app"],
		["a".repeat(70), "a".repeat(58)],
	] as const) {
		expect(run([name]).status).toBe(0);
		const app = join(root, name);
		const env = readFileSync(join(app, ".env.local"), "utf8");
		expect(env).toContain(`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/${database}_dev\n`);
		expect(env).toContain(`TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/${database}_test\n`);
		const secret = env.match(/^BETTER_AUTH_SECRET=(?<secret>.+)$/mu)?.groups?.secret ?? "";
		expect(secret.length).toBeGreaterThanOrEqual(32);
		secrets.add(secret);
		expect(spawnSync("git", ["init", "--quiet"], { cwd: app }).status).toBe(0);
		expect(spawnSync("git", ["check-ignore", ".env.local"], { cwd: app, encoding: "utf8" }).stdout).toBe(".env.local\n");
	}
	expect(secrets.size).toBe(3);
});

it("preserves an existing environment and refuses to run again even after installation failure", () => {
	const { root, run } = appFolder({ installationExit: 7 });
	expect(run(["my-app"]).status).toBe(1);
	const path = join(root, "my-app/.env.local");
	const env = readFileSync(path, "utf8");
	expect(run(["my-app"]).stderr).toContain("the destination must be an empty folder");
	expect(readFileSync(path, "utf8")).toBe(env);
});

it("runs generated pnpm test with TEST_DATABASE_URL loaded from .env.local", () => {
	const { root, run } = appFolder();
	expect(run(["my-app"]).status).toBe(0);
	const app = join(root, "my-app");
	const result = testEnvironment(app).run();
	expect(result.status, result.stdout + result.stderr).toBe(0);
});

it("prepares both generated databases with db:setup and connects to each on real PostgreSQL", () => {
	const { root, run } = appFolder();
	expect(run(["my-app"]).status).toBe(0);
	const app = testEnvironment(join(root, "my-app"), { databases: true });
	const setup = app.prepareDatabases();
	expect(setup.status, setup.stdout + setup.stderr).toBe(0);
	const result = app.run();
	expect(result.status, result.stdout + result.stderr).toBe(0);
});

it("does not overwrite a user environment in an otherwise empty destination", () => {
	const { root, run } = appFolder({ destination: "environment" });
	const app = join(root, "my-app");
	expect(run(["my-app"]).status).toBe(1);
	expect(readFileSync(join(app, ".env.local"), "utf8")).toBe("user settings");
	expect(readdirSync(app)).toEqual([".env.local"]);
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
