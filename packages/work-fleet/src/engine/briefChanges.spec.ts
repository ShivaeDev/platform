import { Effect } from "effect";
import { expect } from "vitest";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { briefAtPhase, criteriaBrief, noChangeDuringBriefPhase } from "#test/engineBriefFixtures.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

for (const field of ["criteria", "body"]) {
	for (const phase of ["preparation", "execution", "review", "decision"]) {
		engine.it(
			`${field} edits during ${phase} refresh active work and approve pending worker answers after restart`,
			[markdownWork(), noChangeDuringBriefPhase(phase), briefAtPhase(phase, criteriaBrief)],
			function* ({ boardBrief, writeBoardWork, answerWorker, providerCalls, restart, fleet }) {
				const original = criteriaBrief(boardBrief());
				const active = yield* fleet.get("one");
				if (phase === "decision") {
					const decision = active.value.decision ?? (yield* Effect.die("Missing worker question"));
					yield* answerWorker(decision);
				}
				const turns = providerCalls().filter((call) => call.call === "turn").length;
				const current = field === "criteria" ? original.replace("Original behavior.", "Changed behavior.") : `${original}\nChanged scope.\n`;
				writeBoardWork("one.md", current);
				yield* restart();
				const stopped = yield* phase === "preparation" ? fleet.dispatch("one") : fleet.reconcile("one");
				expect(stopped.value.step).toBe(phase === "review" ? "reviewing" : "working");
				expect(stopped.value.boardContext).toBe(current);
				expect(stopped.value.boardRevision).toBe(briefRevision(metadataParse(current)));
				expect(stopped.value.decision).toBeUndefined();
				if (phase === "decision") {
					expect(stopped.value.attempts.at(-1)?.prompt).toContain(current);
					expect(stopped.value.responses).toMatchObject([{ action: "continue", boardAcknowledged: true }]);
					expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(turns + 1);
				} else {
					if (phase === "preparation") {
						expect(stopped.value.attempts[0]?.receipt).toBeDefined();
					} else {
						expect(stopped.value.attempts[0]?.receipt).toEqual(active.value.attempts[0]?.receipt);
					}
					expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(turns + (phase === "preparation" ? 1 : 0));
				}
			},
		);
	}
}
