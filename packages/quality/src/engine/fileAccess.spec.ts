import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { manifestReadPending, scanFileAccess, scanRunning, unavailableRead } from "#test/scanFileAccess.ts";

scanFileAccess.it(
	"interrupting a scan stops its pending manifest read without reading the next manifest",
	[manifestReadPending, scanRunning],
	function* ({ interrupts, manifestReads, pendingRead }) {
		expect(yield* pendingRead()).toBe("pending");

		yield* interrupts();

		yield* outcomes([
			["pending manifest read", () => pendingRead(), "stopped"],
			["manifest reads", () => manifestReads(), ["package.json"]],
		]);
	},
);

scanFileAccess.it(
	"an unreadable manifest becomes a manifests/valid finding",
	[unavailableRead("package.json", "PermissionDenied")],
	function* ({ checks, findings }) {
		yield* checks();

		expect(yield* findings()).toEqual([
			{ file: "package.json", message: expect.stringMatching(/^cannot read <root>\/package\.json: .*PermissionDenied/u), rule: "manifests/valid" },
		]);
	},
);

scanFileAccess.it(
	"a manifest removed after discovery becomes a manifests/valid finding",
	[unavailableRead("package.json", "NotFound")],
	function* ({ checks, findings }) {
		yield* checks();

		expect(yield* findings()).toEqual([{ file: "package.json", message: "required input is missing: package.json", rule: "manifests/valid" }]);
	},
);

for (const reason of ["NotFound", "PermissionDenied"] as const) {
	scanFileAccess.it(
		`an Effect rule's ${reason} read failure becomes a finding under that rule`,
		[unavailableRead("tsconfig.json", reason)],
		function* ({ checks, findings }) {
			yield* checks();

			expect(yield* findings()).toEqual(
				expect.arrayContaining([
					{
						file: "tsconfig.json",
						message: expect.stringContaining(reason === "NotFound" ? "required input is missing:" : "cannot read"),
						rule: "suppressions/no-ignore-deprecations",
					},
				]),
			);
		},
	);
}

scanFileAccess.it("a normal scan keeps manifest sorting and TypeScript suppression findings", [], function* ({ checks, findings }) {
	yield* checks();

	expect(yield* findings()).toEqual([
		{ file: "tsconfig.json", message: expect.stringContaining('Sets "ignoreDeprecations"'), rule: "suppressions/no-ignore-deprecations" },
		{ file: "package.json", message: "Keys are not in sort-package-json order. Run `quality fix`.", rule: "manifests/sorted" },
	]);
});
