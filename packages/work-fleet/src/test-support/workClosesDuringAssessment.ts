import { Effect } from "effect";
import { engineScenario } from "#test/engineScenario.ts";
import { mainObservation } from "#test/preparation.ts";

export function workClosesDuringAssessment() {
	return engineScenario("Board work can close during main assessment", () => {
		let closeWork: (() => void) | undefined;
		return {
			context: {
				get closeWork() {
					return closeWork;
				},
				set closeWork(value: typeof closeWork) {
					closeWork = value;
				},
			},
			options: {
				mainQuery: (preparation) => Effect.sync(() => closeWork?.()).pipe(Effect.as(mainObservation({ fromRevision: preparation.baseRevision }))),
			},
		};
	});
}
