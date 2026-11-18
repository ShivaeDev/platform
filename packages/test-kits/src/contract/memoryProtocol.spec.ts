import { expect } from "vitest";
import { memoryGroups } from "#test/memoryGroups.ts";

memoryGroups.it(
	"a group whose RPC shows a field that it also hides is refused in memory with the host's startup message",
	[],
	function* ({ readSets }) {
		const answer = yield* readSets("a group whose best set shows reps that its logged set hides");

		expect(answer).toBe(
			'refused: Sensitive field "reps" in schema Sets.read.success.logged.reps conflicts with public field in schema Sets.read.success.best.reps; RPC diagnostics cannot distinguish these fields. Use distinct field names or mark both fields sensitive.',
		);
	},
);

memoryGroups.it("a group whose RPC hides the field everywhere is served in memory and answers its handler's sets", [], function* ({ readSets }) {
	const answer = yield* readSets("a group whose sets all hide their reps");

	expect(answer).toEqual({ best: { reps: 12 }, logged: { reps: 8 } });
});

memoryGroups.it(
	"a group with a shown and hidden field is served in memory once the spec lists the field as a sensitive key",
	[],
	function* ({ readSets }) {
		const answer = yield* readSets("a group whose best set shows reps that its logged set hides", ["reps"]);

		expect(answer).toEqual({ best: { reps: 12 }, logged: { reps: 8 } });
	},
);

memoryGroups.it(
	"a group whose failure mask its own schema rejects is refused in memory with the host's startup message",
	[],
	function* ({ readSets }) {
		const answer = yield* readSets("a group whose failure hides a positive count behind a mask of zero");

		expect(answer).toBe(
			'refused: Sensitive field "Sets.read.error[0].attempts" needs a schema-compatible mask; supply a redactionMask annotation on its wire schema.',
		);
	},
);
