import { expect } from "vitest";
import { application } from "#test/application.ts";
import { enclosingRepository, failingQualityGate, installedPackageManager, realSetup } from "#test/traits.ts";

const CLI_TIMEOUT = 60_000;

for (const minimal of [false, true]) {
	application.it(
		`installs the active Quality gate before the initial commit${minimal ? " in a minimal app" : ""}`,
		[realSetup, installedPackageManager],
		function* ({ cli, read, git }) {
			const result = yield* cli(["my-app", ...(minimal ? ["--minimal"] : [])]);
			expect(result.status, result.stdout + result.stderr).toBe(0);
			expect(read(".git/hooks/pre-commit")).toContain("Installed by @shivaedev/quality");
			const setup = JSON.parse(read(".git/setup-order.json"));
			expect(setup.head).not.toBe(0);
			expect(setup.staged).toBe("");
			const gate = JSON.parse(read(".git/initial-gate.json"));
			expect(gate.staged.split("\n")).toEqual(expect.arrayContaining(["package.json", "pnpm-lock.yaml", "src/server/server.ts"]));
			expect(git("rev-list", "--count", "HEAD").stdout).toBe("1\n");
		},
		CLI_TIMEOUT,
	);
}

application.it(
	"runs setup again with an existing installation and keeps the Quality gate active",
	[realSetup, installedPackageManager],
	function* ({ cli, pnpm, read }) {
		const generated = yield* cli(["my-app"]);
		expect(generated.status, generated.stdout + generated.stderr).toBe(0);
		const setup = pnpm("run", "setup");
		expect(setup.status, setup.stdout + setup.stderr).toBe(0);
		expect(read(".git/hooks/pre-commit")).toContain("Installed by @shivaedev/quality");
	},
	CLI_TIMEOUT,
);

application.it(
	"blocks the initial commit when the installed Quality gate fails",
	[failingQualityGate, installedPackageManager],
	function* ({ cli, exists, git }) {
		const result = yield* cli(["my-app"]);
		const exitCode = result.status;
		expect(exitCode, result.stdout + result.stderr).toBe(1);
		expect(exists(".git/hooks/pre-commit")).toBe(true);
		expect(exists(".git/initial-gate.json")).toBe(true);
		expect(result.stderr).toContain("commit -m Initialize a generated app failed");
		expect(git("rev-parse", "--verify", "HEAD").status).not.toBe(0);
	},
	CLI_TIMEOUT,
);

application.it(
	"runs setup without a hook when a repository encloses the app",
	[realSetup, installedPackageManager, enclosingRepository],
	function* ({ cli, exists, workspaceExists }) {
		const result = yield* cli(["my-app"]);
		expect(result.status, result.stdout + result.stderr).toBe(0);
		expect(exists("node_modules")).toBe(true);
		expect(exists(".git")).toBe(false);
		expect(workspaceExists(".git/hooks/pre-commit")).toBe(false);
	},
);
