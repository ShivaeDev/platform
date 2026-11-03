import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { unavailableBriefValidation } from "#test/unavailableBriefValidation.ts";
import { briefRefusingFleet } from "#test/workspaceBoardTraits.ts";

const source = projectFiles({ "task.md": "---\nid: task.one\nkind: task\n---\n# Task\n" });

boardStory.it(
	"source diagnostics show that Fleet could not check the brief",
	[source, unavailableBriefValidation()],
	function* ({ sourceDiagnosticsOf }) {
		expect(yield* sourceDiagnosticsOf("task.md")).toEqual({
			problems: ["task.md:2 — Fleet brief validation is unavailable; this brief has not been checked."],
			status: expect.stringContaining("Source diagnostics"),
		});
	},
);

boardStory.it(
	"source diagnostics keep Fleet's refusal visible",
	[source, briefRefusingFleet({ "task.one": "Give this brief a new id" })],
	function* ({ sourceDiagnosticsOf }) {
		expect(yield* sourceDiagnosticsOf("task.md")).toEqual({
			problems: ["task.md:2 — Give this brief a new id"],
			status: expect.stringContaining("Source diagnostics"),
		});
	},
);
