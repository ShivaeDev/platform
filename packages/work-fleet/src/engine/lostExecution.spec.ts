import { expect } from "@effect/vitest";
import { executing } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { unobservableExecution } from "#test/unobservableExecution.ts";

for (const role of ["worker", "repair"] as const) {
	{
		let now = 100;
		const failure = new SessionFailure({ code: "session-unavailable", message: "Lost thread acknowledgement", reason: "ambiguous" });
		const unobservableExecutionTrait = engineConfiguration(
			"unobservable execution",
			unobservableExecution({ failure: () => failure, now: () => now }),
		);
		isolatedEngine.it(
			`lost ${role} read exhaustion retains ownership without a replacement`,
			[unobservableExecutionTrait],
			function* ({ replaceStoredRecord, publishedDecisions, prepareWork, restart, fleet, schedule }) {
				yield* prepareWork("one");
				const started = yield* fleet.dispatch("one");
				yield* replaceStoredRecord({ ...started.value, attempts: started.value.attempts.map((attempt) => ({ ...attempt, role })) });
				for (const delay of [30_000, 60_000, 120_000, 240_000]) {
					now += delay;
					yield* restart();
					yield* schedule();
				}
				const parked = (yield* fleet.get("one")).value;
				expect(parked.decision?.reason).toContain("provider read failure after 5 attempts");
				expect(parked.step).toBe("waiting");
				expect(executing(parked)).toBe(true);
				expect(parked.attempts).toHaveLength(1);
				expect(parked.launchRetry).toBeUndefined();
				now += 1_000_000;
				yield* restart();
				yield* schedule();
				expect((yield* fleet.get("one")).value.attempts).toEqual(parked.attempts);
				expect(publishedDecisions()).toHaveLength(1);
			},
		);
	}
}
