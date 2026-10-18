import { expect } from "vitest";
import { application } from "#test/application.ts";

application.it(
	"gives a generated app its own guidance, documentation, names and normal file permissions",
	[],
	({ cli, read, guidanceLink, files, generatedFiles, exists }) => {
		const result = cli(["demo", "--no-git"], ["NODE_OPTIONS=--import=data:text/javascript,process.umask(0o077)"]);
		expect(result.status, result.stdout + result.stderr).toBe(0);
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
		expect(guidanceLink()).toBe("AGENTS.md");
		expect(read(".env.example")).toContain("/demo_dev\n");
		expect(read(".env.example")).toContain("/demo_test\n");
		expect(files()).not.toContain("published-versions.json");
		for (const file of generatedFiles()) {
			expect(file.path).not.toMatch(/starter/iu);
			expect(file.content, file.path).not.toMatch(/starter/iu);
			expect(file.mode, file.path).toBe(file.path === ".env.local" ? 0o600 : 0o644);
		}
		for (const path of JSON.parse(read("tsconfig.json")).include) {
			expect(exists(path), path).toBe(true);
		}
	},
);
