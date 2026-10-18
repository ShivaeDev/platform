import { expect } from "vitest";
import { installer } from "#starter-published/test-support/installer.ts";

installer.it(
	"the first app commit keeps tarball paths portable and runs its own hook under a global guard",
	[],
	function* ({ install, commit, git, localHookRan, root }) {
		yield* install();
		yield* install();
		yield* commit();
		expect(yield* git("rev-list", "--count", "HEAD")).toBe("1\n");
		for (const file of ["pnpm-workspace.yaml", "pnpm-lock.yaml"]) {
			const committed = yield* git("show", `HEAD:${file}`);
			expect(committed).toContain("file:../archives/packed.tgz");
			expect(committed).not.toContain(root);
		}
		expect(yield* localHookRan()).toBe(true);
	},
);
