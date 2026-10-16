import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, expect, it } from "vitest";
import { appFolder, cleanup, packAppTemplate } from "#test/cli.ts";

beforeAll(packAppTemplate);
afterEach(cleanup);

it("gives a generated app its own files, symlinked guidance and normal file permissions", () => {
	const { root, run } = appFolder({ umask: 0o077 });
	const result = run(["demo"]);
	expect(result.status, result.stdout + result.stderr).toBe(0);
	const app = join(root, "demo");
	for (const path of ["AGENTS.md", "README.md"]) {
		const content = readFileSync(join(app, path), "utf8");
		expect(content).toMatch(/^# demo\n/u);
		expect(content).not.toMatch(/starter|create-app|published-versions|check:published|--registry/iu);
		for (const command of ["pnpm dev", "pnpm test", "pnpm build", "pnpm start"]) {
			expect(content).toContain(command);
		}
		expect(content).toContain("docs/framework/");
	}
	expect(lstatSync(join(app, "CLAUDE.md")).isSymbolicLink()).toBe(true);
	expect(readlinkSync(join(app, "CLAUDE.md"))).toBe("AGENTS.md");
	for (const path of ["published-versions.json", "app-agents.md", "app-readme.md"]) {
		expect(existsSync(join(app, path))).toBe(false);
	}
	const example = readFileSync(join(app, ".env.example"), "utf8");
	expect(example).toContain("/demo_dev\n");
	expect(example).toContain("/demo_test\n");
	expect(readFileSync(join(app, "src/test-support/postgres.ts"), "utf8")).not.toContain("PLATFORM_EFFECT");
	const config = JSON.parse(readFileSync(join(app, "tsconfig.json"), "utf8"));
	for (const path of config.include) {
		expect(existsSync(join(app, path))).toBe(true);
	}
	for (const path of readdirSync(app, { encoding: "utf8", recursive: true })) {
		expect(path).not.toMatch(/starter/iu);
		const file = join(app, path);
		if (lstatSync(file).isFile()) {
			expect(readFileSync(file, "utf8")).not.toMatch(/starter|__APP_/iu);
			expect(statSync(file).mode & 0o777, path).toBe(path === ".env.local" ? 0o600 : 0o644);
		}
	}
});

it("reports formatting failure and keeps the app available for retry", () => {
	const { root, run } = appFolder({ formattingExit: 7 });
	const result = run(["demo"]);
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("pnpm format failed (exit 7). Run pnpm format in demo to retry.");
	expect(existsSync(join(root, "demo/package.json"))).toBe(true);
	expect(statSync(join(root, "demo/pnpm-lock.yaml")).mode & 0o777).toBe(0o644);
});
