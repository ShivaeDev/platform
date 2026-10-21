import { planning } from "./planning.ts";

export const discoveryWorkspace = planning.trait("workspace", "new packages await discovery", ({ workspace }) => {
	workspace.package("new-package", { test: "vitest run" });
	workspace.package("type-only", {});
});
