import { expect } from "vitest";
import { discoveryWorkspace } from "#ci/test-support/discoveryWorkspace.ts";
import { planning } from "#ci/test-support/planning.ts";

planning.it("discovers new test packages and requires their Vitest configs", [discoveryWorkspace], ({ discover, configure, addExample }) => {
	expect(discover).toThrow(/new-package: add a Vitest config/u);
	configure("packages", "new-package");
	expect(discover()).toEqual(["new-package"]);
	addExample("starter");
	expect(discover).toThrow(/starter: add a Vitest config/u);
	configure("examples", "starter");
	expect(discover()).toEqual(["starter", "new-package"]);
});
