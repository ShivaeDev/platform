import assert from "node:assert/strict";
import { test as it } from "node:test";
import { discoveryWorkspace } from "#ci/test-support/discoveryWorkspace.ts";
import { testPackages } from "./testPackages.ts";

it("workspace discovery includes new test packages and refuses to omit a test package without a config", () => {
	const workspace = discoveryWorkspace();
	const { root } = workspace;
	try {
		workspace.package("new-package", { test: "vitest run" });
		workspace.package("type-only", {});
		assert.throws(() => testPackages(root), /new-package: add a Vitest config/u);
		workspace.configured("packages", "new-package");
		assert.deepEqual(
			testPackages(root).map((pkg) => pkg.name),
			["new-package"],
		);
		workspace.example("starter");
		assert.throws(() => testPackages(root), /starter: add a Vitest config/u);
		workspace.configured("examples", "starter");
		assert.deepEqual(
			testPackages(root).map((pkg) => pkg.name),
			["starter", "new-package"],
		);
	} finally {
		workspace.close();
	}
});
