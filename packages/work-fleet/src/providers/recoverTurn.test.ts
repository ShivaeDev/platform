import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { WireRejection } from "#test/codex.ts";
import { cloudThread } from "#test/codexCloud.ts";
import { cloudRecovery, providerStory, timedProviderStory } from "#test/providerStory.ts";
import { byCursor, page, turn } from "#test/wireScript.ts";

const RECOVERY = {
	operationId: "operation",
	resume: { access: "read-only" as const, prompt: "Approved work", settings: { effort: "high", model: "synthetic-model", serviceTier: "priority" } },
	sessionId: "synthetic-session",
};

timedProviderStory.it(
	"two concurrent recoveries on an empty thread wait the whole grace period and then start one read-only turn",
	[cloudRecovery(5000)],
	function* ({ answers, delayNearlyElapses, finalMillisecondElapses, methods, provider, recoveryPollsElapse, sent }) {
		yield* answers({ "thread/read": cloudThread(), "thread/turns/list": page([]), "turn/start": { turn: { id: "synthetic-turn" } } });
		const first = yield* provider.recoverInBackground(RECOVERY);
		const second = yield* provider.recoverInBackground(RECOVERY);
		yield* recoveryPollsElapse(19);
		yield* delayNearlyElapses(250);
		expect(yield* methods("turn/start")).toEqual([]);

		yield* finalMillisecondElapses();

		yield* outcomes([
			["first recovery", () => first.outcome(), "turn synthetic-turn on synthetic-session"],
			["second recovery", () => second.outcome(), "turn synthetic-turn on synthetic-session"],
			["new threads", () => methods("thread/start"), []],
			[
				"started turns",
				() => sent("turn/start"),
				[
					expect.objectContaining({
						...RECOVERY.resume.settings,
						approvalPolicy: "never",
						clientUserMessageId: RECOVERY.operationId,
						input: [expect.objectContaining({ text: RECOVERY.resume.prompt, type: "text" })],
						sandboxPolicy: expect.objectContaining({ networkAccess: true, type: "readOnly" }),
						threadId: RECOVERY.sessionId,
					}),
				],
			],
		]);
	},
);

const UNAVAILABLE = new WireRejection("Thread evidence is unavailable");
const OWN_TURN = turn("turn", "inProgress", "operation");
for (const [evidence, script, input] of [
	["no session", { "thread/turns/list": page([]) }, { ...RECOVERY, sessionId: undefined }],
	["an unreadable thread", { "thread/turns/list": UNAVAILABLE }, RECOVERY],
	["only an unrelated turn", { "thread/turns/list": page([turn("turn", "inProgress")]) }, RECOVERY],
	["two turns for the operation", { "thread/turns/list": page([OWN_TURN, { ...OWN_TURN, id: "other" }]) }, RECOVERY],
	["an unreadable second page", { "thread/turns/list": byCursor({ first: page([], "second"), second: UNAVAILABLE }) }, RECOVERY],
	["no saved prompt", { "thread/turns/list": page([]) }, { ...RECOVERY, resume: undefined }],
] as const) {
	providerStory.it(
		`recovery with ${evidence} fails without starting a thread or turn`,
		[cloudRecovery(1)],
		function* ({ answers, methods, provider }) {
			yield* answers({ "thread/read": cloudThread(), ...script });

			const outcome = yield* provider.recover(input);

			expect(outcome).toMatch(/^session /u);
			expect(yield* methods("thread/start", "turn/start")).toEqual([]);
		},
	);
}
