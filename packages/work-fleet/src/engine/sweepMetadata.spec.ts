import { Effect } from "effect";
import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { sweepTask } from "#test/sweepTask.ts";

engine.it(
	"Board sweep globs reach durable preparation and invalid declarations block admission",
	[markdownWork()],
	function* ({ writeBoardWork, prepareWork, restart, fleet, readBoardPublication }) {
		const paths = ["packages/*/changes/**", "pnpm-workspace.yaml", "**/package.json"];
		writeBoardWork("catalog.md", sweepTask("catalog", paths));
		expect(readBoardPublication("catalog.md").diagnostics).toEqual([]);
		expect((yield* prepareWork("catalog")).value.sweep).toEqual(paths);
		yield* restart();
		expect((yield* fleet.get("catalog")).value.sweep).toEqual(paths);
		for (const invalid of ["release", "[]", "[1]", '[" "]', '["/absolute/**"]', '["../outside/**"]', '["a/../b"]']) {
			const source = sweepTask("invalid").replace("fleet: approved", `fleet: approved\nsweep: ${invalid}`);
			writeBoardWork("invalid.md", source);
			const parsed = readBoardPublication("invalid.md");
			expect(parsed.diagnostics[0]?.field).toBe("sweep");
			expect(parsed.raw + parsed.body).toBe(source);
			const error = yield* prepareWork("invalid").pipe(Effect.flip);
			expect(error.message).toContain("Invalid sweep");
		}
	},
);

engine.it(
	"dispatch reads a newly declared sweep and keeps its reservation after scheduling metadata changes",
	[markdownWork()],
	function* ({ writeBoardWork, prepareWork, fleet }) {
		for (const id of ["catalog", "queued"]) {
			writeBoardWork(`${id}.md`, sweepTask(id));
			yield* prepareWork(id);
		}
		writeBoardWork("catalog.md", sweepTask("catalog", ["*"]));
		expect((yield* fleet.dispatch("catalog")).value.sweep).toEqual(["*"]);
		writeBoardWork("catalog.md", sweepTask("catalog"));
		yield* fleet.reconcile("catalog");
		yield* fleet.dispatch("queued").pipe(Effect.result);
		expect((yield* fleet.get("queued")).value).toMatchObject({ attempts: [], blocker: "waiting for sweep catalog", step: "queued" });
	},
);
