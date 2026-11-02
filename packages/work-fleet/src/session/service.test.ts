import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { SessionFailure } from "#session/schema.ts";
import { cloudThread } from "#test/codexCloud.ts";
import { cloudMetadata, providerSessions, sessionProvider } from "#test/providerSessionStory.ts";
import { receipt, sessionInput } from "#test/sessionPersistence.ts";
import { inTurn, page, turn } from "#test/wireScript.ts";

for (const cloud of [false, true]) {
	providerSessions.it(
		`a ${cloud ? "Cloud" : "local Codex"} session commits its acknowledgement before the next mutation and survives reopening`,
		[sessionProvider(cloud)],
		function* ({ answers, journal, mutations, sessions }) {
			yield* answers({
				"thread/read": cloudThread(),
				"thread/start": { thread: { id: receipt.sessionId } },
				"turn/start": { turn: { id: receipt.turnId } },
			});

			const started = yield* sessions.start(sessionInput);
			expect(started).toEqual(receipt);

			const committed = expect.arrayContaining([
				expect.objectContaining({ operationId: sessionInput.operationId, sessionId: receipt.sessionId, status: "submitting" }),
			]);
			yield* outcomes([
				[
					"committed before provider mutations",
					() => mutations(),
					(cloud ? ["thread/name/set", "turn/start"] : ["turn/start"]).map((method) => ({ attempts: committed, method })),
				],
				[
					"reopened journal",
					() => journal(),
					expect.arrayContaining([expect.objectContaining({ operationId: sessionInput.operationId, receipt, status: "accepted" })]),
				],
			]);
		},
	);
}

for (const command of ["start", "continue"] as const) {
	providerSessions.it(
		`a failed PostgreSQL session write refuses ${command} before any further provider mutation`,
		[cloudMetadata({})],
		function* ({ journal, methods, refuseAcknowledgement, sessions }) {
			yield* refuseAcknowledgement("sessionId");

			const outcome = yield* (
				command === "start" ? sessions.start(sessionInput) : sessions.continue({ ...sessionInput, sessionId: receipt.sessionId })
			).pipe(Effect.flip);

			expect(outcome).toBeInstanceOf(SessionFailure);
			expect(outcome.reason).toBe("persistence");
			yield* outcomes([
				["provider mutations", () => methods("thread/start", "thread/name/set", "turn/start"), command === "start" ? ["thread/start"] : []],
				[
					"unchanged submission intent",
					() => journal(),
					expect.arrayContaining([{ operationId: sessionInput.operationId, role: "worker", status: "submitting", submittedAt: 1 }]),
				],
			]);
		},
	);
}

providerSessions.it(
	"a failed PostgreSQL turn write returns a typed refusal and retains only the committed session",
	[cloudMetadata({})],
	function* ({ journal, refuseAcknowledgement, sessions }) {
		yield* refuseAcknowledgement("receipt__turnId");

		const outcome = yield* sessions.start(sessionInput).pipe(Effect.flip);

		expect(outcome).toBeInstanceOf(SessionFailure);
		expect(outcome.reason).toBe("persistence");
		const attempt = (yield* journal())?.find(({ operationId }) => operationId === sessionInput.operationId);
		expect(attempt).toEqual(expect.objectContaining({ sessionId: receipt.sessionId, status: "submitting" }));
		expect(attempt?.receipt).toBeUndefined();
	},
);

providerSessions.it(
	"a lost turn reply is reconciled into the reopened journal without another submission",
	[sessionProvider(false)],
	function* ({ answers, journal, methods, sessions }) {
		yield* answers({ "thread/start": { thread: { id: receipt.sessionId } }, "turn/start": undefined });
		const outcome = yield* sessions.start(sessionInput).pipe(Effect.flip);
		expect(outcome.reason).toBe("ambiguous");
		yield* answers({ "thread/turns/list": page([turn(receipt.turnId, "inProgress", sessionInput.operationId)]) });

		const reconciled = yield* sessions.reconcile({ operationId: sessionInput.operationId, sessionId: receipt.sessionId });
		expect(reconciled).toEqual(receipt);

		yield* outcomes([
			["single submission", () => methods("turn/start"), ["turn/start"]],
			["reopened journal", () => journal(), expect.arrayContaining([expect.objectContaining({ receipt, status: "accepted" })])],
		]);
	},
);

providerSessions.it(
	"continuing a session preserves the committed turn before the next provider mutation",
	[sessionProvider(false)],
	function* ({ answers, journal, methods, mutations, reserveContinuation, sessions }) {
		yield* answers({
			"thread/start": { thread: { id: receipt.sessionId } },
			"turn/start": inTurn({ turn: { id: receipt.turnId } }, { turn: { id: "repair-turn" } }),
		});
		yield* sessions.start(sessionInput);
		yield* reserveContinuation();

		const continued = yield* sessions.continue({ operationId: "repair", prompt: "repair", sessionId: receipt.sessionId });
		expect(continued).toEqual({ sessionId: receipt.sessionId, turnId: "repair-turn" });

		yield* outcomes([
			[
				"committed before the next turn",
				() => mutations().pipe(Effect.map((snapshots) => snapshots[1])),
				{
					attempts: expect.arrayContaining([
						expect.objectContaining({ operationId: sessionInput.operationId, receipt, status: "accepted" }),
						expect.objectContaining({ operationId: "repair", sessionId: receipt.sessionId, status: "submitting" }),
					]),
					method: "turn/start",
				},
			],
			[
				"reopened journal",
				() => journal(),
				expect.arrayContaining([
					expect.objectContaining({ operationId: "repair", receipt: { sessionId: receipt.sessionId, turnId: "repair-turn" }, status: "accepted" }),
				]),
			],
			["provider mutations", () => methods("thread/start", "turn/start", "turn/interrupt"), ["thread/start", "turn/start", "turn/start"]],
		]);
	},
);
