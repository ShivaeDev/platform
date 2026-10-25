import { expect } from "vitest";
import { application } from "#test/application.ts";
import { enclosingRepository, failingQualityGate, installedPackageManager, realSetup } from "#test/traits.ts";

application.it(
	"installs the active Quality gate after Git initialization and before the initial commit",
	[realSetup, installedPackageManager],
	function* ({ cli, read, git }) {
		const result = yield* cli(["my-app"]);
		expect(result.status, result.stdout + result.stderr).toBe(0);
		expect(read(".git/hooks/pre-commit")).toContain("Installed by @shivaedev/quality");
		const setup = JSON.parse(read(".git/setup-order.json"));
		expect(setup.head).not.toBe(0);
		expect(setup.staged).toBe("");
		const gate = JSON.parse(read(".git/initial-gate.json"));
		expect(gate.staged.split("\n")).toEqual(expect.arrayContaining(["package.json", "pnpm-lock.yaml", "src/server/server.ts"]));
		expect(git("rev-list", "--count", "HEAD").stdout).toBe("1\n");
	},
);

application.it(
	"blocks the initial commit when the installed Quality gate fails",
	[failingQualityGate, installedPackageManager],
	function* ({ cli, exists, git }) {
		const result = yield* cli(["my-app"]);
		expect(result.status, result.stdout + result.stderr).toBe(1);
		expect(exists(".git/hooks/pre-commit")).toBe(true);
		expect(exists(".git/initial-gate.json")).toBe(true);
		expect(result.stderr).toContain("commit -m Initialize a generated app failed");
		expect(git("rev-parse", "--verify", "HEAD").status).not.toBe(0);
	},
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
