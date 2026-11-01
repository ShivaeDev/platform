import { expect } from "vitest";
import { declarationStory } from "#test/declarationStory.ts";

for (const kind of ["query", "command", "stream"] as const) {
	declarationStory.it(`declaring a ${kind} named $changes fails with a reserved-name declaration error`, [], function* ({ declare }) {
		const answer = yield* declare(kind, "$changes");

		expect(answer).toBe("Operation name $changes is reserved for the built-in changes stream on contract notes");
	});

	for (const name of ["get", "$Changes", "$changesExtra"]) {
		declarationStory.it(`declaring a ${kind} named ${name} keeps its RPC alongside the built-in changes stream`, [], function* ({ declare }) {
			const answer = yield* declare(kind, name);

			expect(answer).toEqual({ application: [`notes.${name}`], rpcs: [`notes.${name}`, "notes.$changes"] });
		});
	}
}
