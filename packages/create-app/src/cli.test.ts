import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, join } from "node:path";
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

it("creates a named app in a new parent path, installs, commits as Create App without a configured identity, and prints the next steps", () => {
	const { root, run } = appFolder();
	const result = run(["apps/my-app"], ["EMAIL=guessed@example.com"]);
	expect(result.status).toBe(0);
	const app = join(root, "apps/my-app");
	expect(JSON.parse(readFileSync(join(app, "package.json"), "utf8"))).toMatchObject({ name: "my-app" });
	expect(readFileSync(join(app, "package.json"), "utf8")).toMatch(/^\{\n\t"name": "my-app",/u);
	expect(readFileSync(join(app, "installation.json"), "utf8")).toBe('["run","setup"]');
	expect(spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: app, encoding: "utf8" }).stdout).toBe("1\n");
	expect(spawnSync("git", ["log", "-1", "--format=%an <%ae>"], { cwd: app, encoding: "utf8" }).stdout).toBe("Create App <create-app@localhost>\n");
	expect(spawnSync("git", ["status", "--porcelain"], { cwd: app, encoding: "utf8" }).stdout).toBe("");
	const tracked = spawnSync("git", ["ls-files"], { cwd: app, encoding: "utf8" }).stdout.split("\n");
	expect(tracked).toEqual(
		expect.arrayContaining(["package.json", "pnpm-lock.yaml", ".github/workflows/ci.yml", ".railway/railway.ts", "src/notes.ts"]),
	);
	expect(tracked).not.toContain(".env.local");
	expect(result.stdout).toMatch(/Created apps\/my-app\.\n\nNext steps:\n {2}cd 'apps\/my-app'\n {2}pnpm dev\n$/u);
});

it("preserves the configured Git identity for the initial commit", () => {
	const { root, run } = appFolder();
	expect(
		run(
			["my-app"],
			[
				"GIT_AUTHOR_NAME=App Author",
				"GIT_AUTHOR_EMAIL=author@example.com",
				"GIT_COMMITTER_NAME=App Author",
				"GIT_COMMITTER_EMAIL=author@example.com",
			],
		).status,
	).toBe(0);
	expect(spawnSync("git", ["log", "-1", "--format=%an <%ae>"], { cwd: join(root, "my-app"), encoding: "utf8" }).stdout).toBe(
		"App Author <author@example.com>\n",
	);
});

it("skips git when disabled or unavailable", () => {
	for (const gitAvailable of [true, false]) {
		const { root, run } = appFolder({ gitAvailable });
		const result = run(gitAvailable ? ["my-app", "--no-git"] : ["my-app"]);
		expect(result.status, result.stderr).toBe(0);
		expect(existsSync(join(root, "my-app/.git"))).toBe(false);
	}
});

it("leaves an enclosing repository without a nested repository or a new commit", () => {
	const { root, run } = appFolder();
	expect(spawnSync("git", ["init", "--quiet"], { cwd: root }).status).toBe(0);
	expect(run(["apps/my-app"]).status).toBe(0);
	expect(existsSync(join(root, "apps/my-app/.git"))).toBe(false);
	expect(spawnSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: root }).status).not.toBe(0);
	expect(spawnSync("git", ["diff", "--cached", "--name-only"], { cwd: root, encoding: "utf8" }).stdout).toBe("");
});

it("writes app-specific local database URLs and a fresh secret on every run, ignored by Git", () => {
	const secrets = new Set<string>();
	for (const [name, database] of [
		["my-app", "my_app"],
		["my-app", "my_app"],
	] as const) {
		const { root, run } = appFolder();
		expect(run([name]).status).toBe(0);
		const app = join(root, name);
		const env = readFileSync(join(app, ".env.local"), "utf8");
		const example = readFileSync(join(app, ".env.example"), "utf8");
		expect(example).toContain(`/${database}_dev\n`);
		expect(example).toContain(`/${database}_test\n`);
		expect(env).toContain(`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/${database}_dev\n`);
		expect(env).toContain(`TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/${database}_test\n`);
		const secret = env.match(/^BETTER_AUTH_SECRET=(?<secret>.+)$/mu)?.groups?.secret ?? "";
		expect(secret.length).toBeGreaterThanOrEqual(32);
		secrets.add(secret);
		expect(spawnSync("git", ["check-ignore", ".env.local"], { cwd: app, encoding: "utf8" }).stdout).toBe(".env.local\n");
	}
	expect(secrets.size).toBe(2);
});

it("preserves an existing environment and refuses to run again even after installation failure", () => {
	const { root, run } = appFolder({ installationExit: 7 });
	expect(run(["my-app", "--no-git"]).status).toBe(1);
	const path = join(root, "my-app/.env.local");
	const env = readFileSync(path, "utf8");
	expect(run(["my-app", "--no-git"]).stderr).toContain("the destination must be an empty folder");
	expect(readFileSync(path, "utf8")).toBe(env);
});

it("prepares both generated databases with db:setup, then runs pnpm test with TEST_DATABASE_URL from .env.local on real PostgreSQL", () => {
	const { root, run } = appFolder();
	const name = `setup_${basename(root).slice(-6).toLowerCase()}`;
	expect(run([name, "--no-git"]).status).toBe(0);
	const app = testEnvironment(join(root, name), { databases: true, name });
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
	const result = run([folder, "--no-git"]);
	expect(result.status).toBe(0);
	const cd = result.stdout.split("\n").find((line) => line.trimStart().startsWith("cd "));
	expect(cd).toBeDefined();
	const navigation = spawnSync("sh", ["-c", `${cd}\npwd`], { cwd: root, encoding: "utf8" });
	expect(navigation.status).toBe(0);
	expect(navigation.stdout.trim()).toBe(join(realpathSync(root), folder));
});

it("accepts an existing empty folder", () => {
	const { root, run } = appFolder({ destination: "empty" });
	expect(run(["my-app", "--no-git"]).status).toBe(0);
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
	expect(result.stderr).toContain("pnpm run setup failed (exit 7)");
	expect(result.stderr).toContain("Run pnpm run setup in my-app to retry");
	expect(result.stdout).not.toContain("Next steps");
	expect(existsSync(join(root, "my-app/package.json"))).toBe(true);
	expect(spawnSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: join(root, "my-app") }).status).not.toBe(0);
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
	const help = run(["--help"]);
	expect(help.status).toBe(0);
	expect(help.stdout).toContain("folder");
	expect(run(["--version"])).toMatchObject({ status: 0, stdout: `create-app v${version}\n` });
	expect(readdirSync(root)).toEqual(["bin"]);
});
