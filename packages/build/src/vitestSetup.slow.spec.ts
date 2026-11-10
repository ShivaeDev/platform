import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesApplication, notesTest, refusedModule, vite } from "#test/vite.ts";

const NOTES = "src/generated/modules/notes/notes.ts";

vite.it(
	"vitest's global setup generates the notes wire before the test file that imports it loads",
	[notesApplication(), notesTest()],
	function* ({ generatedFile, runsVitest }) {
		expect(yield* generatedFile(NOTES)).toBe("missing");

		expect(yield* runsVitest()).toEqual({ ran: { "the generated notes wire lists the module's operations": "passed" } });
	},
);

vite.it(
	"a refusal stops vitest before any test file loads, with the generator's message",
	[notesApplication(), refusedModule(), notesTest()],
	function* ({ runsVitest }) {
		const run = yield* runsVitest();

		expect(run).toEqual({
			failed: expect.stringContaining(
				"refused.returnsMap: run returns Map<string, number> at success, which has no exact wire form; return a plain object, an array or a string-keyed record",
			),
			ran: {},
		});
	},
);

vite.it(
	"two vitest runs that start at once both pass and leave every generated file up to date",
	[notesApplication(), notesTest()],
	function* ({ runsVitestTwiceAtOnce, upToDate }) {
		const passed = { ran: { "the generated notes wire lists the module's operations": "passed" } };

		yield* outcomes([
			["the two runs", () => runsVitestTwiceAtOnce(), [passed, passed]],
			["generate --check", () => upToDate(), "every generated file is up to date"],
		]);
	},
);
