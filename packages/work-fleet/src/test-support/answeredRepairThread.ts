import { Effect } from "effect";
import type { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
export function answeredRepairThread(controls: {
	readonly repair: () => "checks" | "review";
	readonly unusableSession: () => string | undefined;
	readonly rejection: () => SessionFailure;
	readonly now: () => number;
	readonly head: () => string;
}) {
	return engineConfiguration("answered repair thread", () => ({
		checksQuery: (result) =>
			Effect.succeed({
				evidence: ["Required build check"],
				head: result.head,
				passed: controls.repair() === "review" || result.head === "repaired-head",
				repairPrompt: "Fix the failed required check",
			}),
		decorateTransport: (transport) => ({
			...transport,
			startTurn: (input) => (input.sessionId === controls.unusableSession() ? Effect.fail(controls.rejection()) : transport.startTurn(input)),
		}),
		now: () => controls.now(),
		repairs: controls.repair() === "review",
		resultQuery: () => Effect.succeed({ head: controls.head(), kind: "change", paths: ["src/one.ts"], pr: "https://example.invalid/pr/one" }),
	}));
}
