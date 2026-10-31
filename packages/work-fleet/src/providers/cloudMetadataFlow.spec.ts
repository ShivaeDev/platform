import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { SYNTHETIC_WORKSPACE } from "#test/codexCloud.ts";
import { cloudMetadata, providerSessions } from "#test/providerSessionStory.ts";
import { receipt } from "#test/session.ts";

const input = { cwd: SYNTHETIC_WORKSPACE, operationId: "synthetic-operation", prompt: "Synthetic work" };

for (const threadNamePrefix of [undefined, "Automation: "]) {
	providerSessions.it(
		`a Cloud session is named with the ${threadNamePrefix === undefined ? "default" : "configured"} prefix after it is journaled and before its turn starts`,
		[cloudMetadata(threadNamePrefix === undefined ? {} : { threadNamePrefix })],
		function* ({ journal, methods, sent, sessions }) {
			yield* sessions.start(input);

			yield* outcomes([
				[
					"thread name",
					() => sent("thread/name/set"),
					[{ name: `${threadNamePrefix ?? "Fleet: "}synthetic-work: Synthetic work`, threadId: receipt.sessionId }],
				],
				["journal", () => journal(), [receipt.sessionId, "name requested"]],
				["call order", () => methods("thread/name/set", "turn/start"), ["thread/name/set", "turn/start"]],
			]);
		},
	);
}

for (const [configured, expected] of [
	[{ projectId: "synthetic-project" }, [expect.objectContaining({ projectId: "synthetic-project" })]],
	[{}, [expect.not.objectContaining({ projectId: expect.anything() })]],
] as const) {
	providerSessions.it(
		`a Cloud thread starts ${"projectId" in configured ? "in the configured project" : "without a project when none is configured"}`,
		[cloudMetadata(configured)],
		function* ({ sent, sessions }) {
			yield* sessions.start(input);

			expect(yield* sent("thread/start")).toEqual(expected);
		},
	);
}

for (const [archiveThreads, archived] of [
	[undefined, [{ threadId: receipt.sessionId }]],
	[false, []],
] as const) {
	providerSessions.it(
		`archiving a session ${archived.length === 0 ? "keeps its Cloud thread when host config turns archiving off" : "archives its Cloud thread"}`,
		[cloudMetadata(archiveThreads === undefined ? {} : { archiveThreads })],
		function* ({ sent, sessions }) {
			yield* sessions.start(input);

			yield* sessions.archive(receipt.sessionId);

			expect(yield* sent("thread/archive")).toEqual(archived);
		},
	);
}

for (const [nameFailure, cause] of [
	["rejected", "Name rejected"],
	["timeout", "Codex request timed out"],
] as const) {
	providerSessions.it(
		`a ${nameFailure} thread name still starts the turn and warns with the session and cause`,
		[cloudMetadata({ nameFailure, requestTimeoutMs: 1000 })],
		function* ({ sent, sessions, warnings }) {
			const started = yield* sessions.start(input);

			expect(started).toEqual(receipt);
			yield* outcomes([
				["started turns", () => sent("turn/start"), [expect.objectContaining({ threadId: receipt.sessionId })]],
				[
					"warnings",
					() => warnings(),
					[
						{
							annotations: { sessionId: receipt.sessionId },
							cause: expect.stringContaining(cause),
							message: ["Fleet session naming failed; starting the turn"],
						},
					],
				],
			]);
		},
	);
}
