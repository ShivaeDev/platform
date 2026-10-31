import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { engine } from "#test/engineStory.ts";
import { recordedCiFailures } from "#test/recordedCiFailures.ts";

engine.it(
	"CI repair turns carry each failed job's tests and assertions without runner noise, counting repeated failures",
	[recordedCiFailures()],
	function* ({ fleet, prepareWork, finishWorkers, providerTurns }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();

		yield* fleet.reconcile("one");

		function prompt() {
			return Effect.sync(() => providerTurns().at(-1)?.prompt);
		}
		yield* outcomes([
			...(["browser", "verify"] as const).flatMap((name) => [
				[`${name} job`, prompt, expect.stringContaining(`Job: ${name}`)] as const,
				[`${name} first test`, prompt, expect.stringContaining(`FAIL  ${name}.spec.ts > sends the repair assertion`)] as const,
				[`${name} second test`, prompt, expect.stringContaining(`FAIL  ${name}.spec.ts > names the failing worker`)] as const,
			]),
			["repeat count", prompt, expect.stringContaining("Occurrences: 2 (1 repeat)")],
			["assertion", prompt, expect.stringContaining("AssertionError: expected { status: 'waiting' } to deeply equal { status: 'repairing' }")],
			["full diff", prompt, expect.stringContaining('-   "status": "repairing",\n+   "status": "waiting",')],
			["second assertion", prompt, expect.stringContaining('Expected: "alice"\nReceived: "unknown worker"')],
			["color removed", prompt, expect.not.stringContaining("\u001b")],
			["runner noise removed", prompt, expect.not.stringMatching(/2026-10-31T12:|##\[|Progress:|Test Files|Process completed|Job: optional/u)],
		]);
	},
);

for (const access of ["unreadable", "empty", "partial"] as const) {
	engine.it(
		`CI repair turns report ${access} logs${access === "partial" ? " and keep available assertions" : ""}`,
		[recordedCiFailures(access)],
		function* ({ fleet, prepareWork, finishWorkers, providerTurns }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();

			yield* fleet.reconcile("one");

			function prompt() {
				return Effect.sync(() => providerTurns().at(-1)?.prompt);
			}
			yield* outcomes([
				["unavailable browser log", prompt, expect.stringContaining("Job: browser\nNo readable CI job logs are available.")],
				[
					"verify log",
					prompt,
					expect.stringContaining(
						access === "partial"
							? "AssertionError: expected { status: 'waiting' } to deeply equal { status: 'repairing' }"
							: "Job: verify\nNo readable CI job logs are available.",
					),
				],
			]);
		},
	);
}
