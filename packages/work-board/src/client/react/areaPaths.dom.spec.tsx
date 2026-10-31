import { expect } from "vitest";
import { areaRepository } from "#test/areaRepository.ts";
import { boardStory } from "#test/boardStory.ts";

boardStory.it(
	"A brief's source diagnostics name its invalid area and suggest the folder it meant",
	[areaRepository(["effect-react"])],
	function* ({ sourceDiagnosticsOf }) {
		expect(yield* sourceDiagnosticsOf("task.md")).toEqual({
			problems: ['task.md:4 — Area "effect-react" does not name an existing repository folder. Did you mean "react"?'],
			status: expect.stringContaining("Source diagnostics"),
		});
	},
);
