import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired, markdownWork } from "#test/engineTraits.ts";

engine.it(
	"dropping an edited ready brief releases it without resuming its worker",
	[humanMergeRequired(), markdownWork()],
	function* ({ fleet, prepareWork, finishWorkers, boardBrief, writeBoardWork, providerStarts }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("reviewed-pr-ready");
		const starts = providerStarts();
		writeBoardWork("one.md", `${boardBrief().replace("kind: task", "kind: task\nstatus: dropped")}\nChanged scope.\n`);
		expect((yield* fleet.reconcile("one")).value.step).toBe("released");
		expect(providerStarts()).toEqual(starts);
	},
);
