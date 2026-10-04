import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as it } from "node:test";
import { testPackages } from "./testPackages.ts";

it("workspace discovery includes new test packages and refuses to omit a test package without a config", () => {
	const root = mkdtempSync(join(tmpdir(), "platform-discovery-"));
	try {
		for (const name of ["new-package", "type-only"]) {
			mkdirSync(join(root, "packages", name), { recursive: true });
			writeFileSync(
				join(root, "packages", name, "package.json"),
				JSON.stringify({ name, scripts: name === "type-only" ? {} : { test: "vitest run" } }),
			);
		}
		assert.throws(() => testPackages(root), /new-package: add a Vitest config/u);
		writeFileSync(join(root, "packages", "new-package", "vitest.config.ts"), "export default {};");
		assert.deepEqual(
			testPackages(root).map((pkg) => pkg.name),
			["new-package"],
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
