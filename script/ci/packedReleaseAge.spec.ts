import { expect } from "vitest";
import { packedReleaseAge } from "#ci/test-support/packedReleaseAge.ts";

for (const path of ["consumer", "starter"] as const) {
	packedReleaseAge.it(
		`the packed ${path} keeps mature matches and installs the lowest fresh transitive match when required`,
		[],
		function* ({ install, resolved }) {
			yield* install(path);

			expect(JSON.parse(yield* resolved())).toEqual({ fresh: "1.0.2", mature: "1.0.1", parent: "1.1.0" });
		},
	);
}
