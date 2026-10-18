import { Option } from "effect";
import { expect } from "vitest";
import { inputIssues } from "#test/inputIssues.ts";
import { trpc } from "#test/routerStory.ts";

trpc.it(
	"formats primitive and keyed Standard Schema path segments",
	[inputIssues([{ message: "Must be a nonempty string", path: ["profiles", 1, { key: "name" }] }])],
	function* ({ rejectQuery, rejection }) {
		const error = yield* rejectQuery("save");
		expect(error).toMatchObject({ data: { path: "save" } });
		expect(rejection(error)).toEqual(
			Option.some({ _tag: "BadRequest", field: "profiles.1.name", invalidInput: true, message: "Must be a nonempty string" }),
		);
	},
);
trpc.it("omits the field for a Standard Schema root issue", [inputIssues([{ message: "Must be a record" }])], function* ({ rejectQuery, rejection }) {
	expect(rejection(yield* rejectQuery("save"))).toEqual(Option.some({ _tag: "BadRequest", invalidInput: true, message: "Must be a record" }));
});
