import { expect } from "vitest";
import { application } from "#test/application.ts";

application.it(
	"gives a generated app its own guidance, documentation, names and normal file permissions",
	[],
	function* ({ cli, read, guidanceLink, files, generatedFiles, exists }) {
		const result = yield* cli(["demo", "--no-git"], ["NODE_OPTIONS=--import=data:text/javascript,process.umask(0o077)"]);
		expect(result.status, result.stdout + result.stderr).toBe(0);
		expect(read("README.md")).toMatch(/^# demo\n/u);
		for (const path of ["README.md", "AGENTS.md"]) {
			expect(read(path)).not.toMatch(/starter|check:published|--registry|published-versions/iu);
			expect(read(path)).toContain("pnpm dev");
			expect(read(path)).toContain("pnpm test");
			expect(read(path)).toContain("docs/framework/");
		}
		expect(read("README.md")).toContain("pnpm dlx @shivaedev/create-app@latest update");
		expect(read("README.md")).toContain("`.create-app.json` records the generator version");
		expect(guidanceLink()).toBe("AGENTS.md");
		expect(read(".env.example")).toContain("/demo_dev\n");
		expect(read(".env.example")).toContain("/demo_test\n");
		expect(files()).not.toContain("published-versions.json");
		for (const path of ["src/client/ui/chart.tsx", "src/client/ui/tooltip.tsx"]) {
			expect(exists(path), path).toBe(false);
		}
		expect(JSON.parse(read("package.json")).dependencies).not.toHaveProperty("recharts");
		for (const file of generatedFiles()) {
			expect(file.path).not.toMatch(/starter/iu);
			expect(file.content, file.path).not.toMatch(/starter/iu);
			expect(file.mode, file.path).toBe(file.path === ".env.local" ? 0o600 : 0o644);
		}
	},
);

application.it("carries the coverage CI workflow and ignores its reports", [], function* ({ cli, read, starterFile, git }) {
	const result = yield* cli(["demo", "--no-git"]);
	expect(result.status, result.stdout + result.stderr).toBe(0);
	const workflow = read(".github/workflows/ci.yml");
	expect(workflow).toBe(starterFile(".github/workflows/ci.yml"));
	expect(workflow).toContain("run: pnpm run ci --coverage");
	expect(workflow).toContain("name: coverage-tests");
	expect(git("init", "--quiet").status).toBe(0);
	expect(git("check-ignore", "coverage/lcov.info", "coverage/junit.xml", "coverage/measured-commits.txt", "coverage/job.txt").stdout).toBe(
		"coverage/lcov.info\ncoverage/junit.xml\ncoverage/measured-commits.txt\ncoverage/job.txt\n",
	);
});

application.it("gives generated apps an ignored local browser check outside their CI gate", [], function* ({ cli, read, git }) {
	const result = yield* cli(["demo", "--no-git"]);

	expect(result.status, result.stdout + result.stderr).toBe(0);
	const manifest = JSON.parse(read("package.json"));
	expect(manifest.scripts["browser-check"]).toBe("browser-check");
	expect(manifest.devDependencies).toHaveProperty("@shivaedev/browser-check");
	for (const name of ["ready", "ci", "setup"]) {
		expect(manifest.scripts[name]).not.toMatch(/browser-check|playwright/u);
	}
	expect(read(".github/workflows/ci.yml")).not.toMatch(/browser-check|playwright/u);
	expect(read("README.md")).toContain("End-to-end browser tests do not belong in an app's CI");
	expect(git("init", "--quiet").status).toBe(0);
	expect(git("check-ignore", ".browser-check/1.png").stdout).toBe(".browser-check/1.png\n");
});
