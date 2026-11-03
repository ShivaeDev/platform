import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ended } from "#test/piEvents.ts";
import { heldPreflight, noCredentials, noSessionFile, pi, refusedPreflight } from "#test/piStory.ts";

pi.it(
	"preflight accepts the caller's operation while the Pi completion promise remains pending",
	[],
	function* ({ start, inspect, calls, reconcile }) {
		const receipt = yield* start();

		expect(receipt.operationId).toBe("Build an app");
		yield* outcomes([
			["observed state", () => inspect(), { state: "accepted", type: "known" }],
			["acceptance evidence", () => reconcile("Build an app"), { receipt, type: "accepted" }],
			["Pi prompt", () => calls(), [{ delivery: "followUp", text: "Build an app" }]],
		]);
	},
);

pi.it("a held preflight has no acceptance evidence until Pi accepts it", [heldPreflight], function* ({ begin, reconcile, accept, join }) {
	const pending = yield* begin();
	expect(yield* reconcile("Build an app")).toMatchObject({ type: "uncertain" });

	yield* accept();

	const receipt = yield* join(pending);
	expect(yield* reconcile("Build an app")).toEqual({ receipt, type: "accepted" });
});

pi.it("preflight refusal remains a typed refusal and never becomes acceptance", [refusedPreflight], function* ({ startRefusal, reconcile }) {
	const result = yield* startRefusal();

	expect(result).toEqual({ outcome: "rejected", reason: "compaction in progress" });
	expect(yield* reconcile("Refused")).toMatchObject({ type: "uncertain" });
});

pi.it("queued input and steering reach distinct Pi delivery modes", [], function* ({ start, queue, steer, calls }) {
	yield* start();

	yield* queue("Add a route");
	yield* steer("Keep it small");

	expect(yield* calls()).toEqual([
		{ delivery: "followUp", text: "Build an app" },
		{ delivery: "followUp", text: "Add a route" },
		{ delivery: "steer", text: "Keep it small" },
	]);
});

pi.it(
	"resume opens the persisted session file and passes its history to the SDK after a runtime restart",
	[],
	function* ({ start, dispose, restart, resume, opened, reconcile }) {
		const receipt = yield* start();
		yield* dispose();
		yield* restart();
		expect(yield* reconcile("Build an app")).toMatchObject({ type: "uncertain" });

		const resumed = yield* resume();

		expect(resumed.session).toEqual(receipt.session);
		expect((yield* opened())[1]).toMatchObject({
			file: receipt.session?.value,
			history: [{ message: { content: "Build an app", role: "user" } }, { message: { role: "assistant" } }],
		});
	},
);

pi.it("a retrying agent end keeps the run running and preserves the provider event", [], function* ({ start, emit, inspect, events }) {
	yield* start();
	yield* emit({ type: "agent_start" });
	expect(yield* inspect()).toEqual({ state: "running", type: "known" });

	yield* emit(ended("error", true));

	yield* outcomes([
		["observed state", () => inspect(), { state: "running", type: "known" }],
		[
			"retry event",
			() => events(4),
			[
				{ type: "acknowledged" },
				{ type: "session.opened" },
				{ state: "running", type: "execution" },
				{ raw: { kind: "agent_end", payload: JSON.stringify(ended("error", true)), source: "pi" }, type: "raw" },
			],
		],
	]);
});

for (const [stopReason, state] of [
	["stop", "completed"],
	["error", "failed"],
	["aborted", "interrupted"],
] as const) {
	pi.it(`a final ${stopReason} reports ${state}`, [], function* ({ start, emit, inspect }) {
		yield* start();

		yield* emit(ended(stopReason));

		expect(yield* inspect()).toEqual({ state, type: "known" });
	});
}

pi.it("scope disposal aborts Pi, disposes it and detaches the listener", [], function* ({ start, dispose, released, inspect }) {
	yield* start();
	expect(yield* released()).toEqual({ aborted: 0, disposed: 0, listeners: 1 });

	yield* dispose();

	yield* outcomes([
		["released runtime", () => released(), { aborted: 1, disposed: 1, listeners: 0 }],
		["execution evidence", () => inspect(), { type: "missing" }],
	]);
});

pi.it("interruption calls Pi abort without disposing the runtime", [], function* ({ start, interrupt, released }) {
	yield* start();

	yield* interrupt();

	expect(yield* released()).toEqual({ aborted: 1, disposed: 0, listeners: 1 });
});

pi.it("model lookup uses the credential-backed provider and forwards the thinking level", [], function* ({ start, opened, models }) {
	expect(yield* models()).toMatchObject([{ id: "anthropic/sonnet" }, { id: "openai/gpt" }]);

	yield* start("Use GPT", "openai/gpt", "high");

	expect((yield* opened())[0]).toMatchObject({ effort: "high", model: { id: "gpt", provider: "openai" } });
});

pi.it("a model absent from the credential-backed catalog is refused before session creation", [], function* ({ startRefusal, opened }) {
	const result = yield* startRefusal("missing/model");

	expect(result).toEqual({
		outcome: "rejected",
		reason: "Pi offers no model missing/model with credentials; choose provider/model-id from its catalog",
	});
	expect(yield* opened()).toEqual([]);
});

pi.it("missing credentials refuse the default model before session creation", [noCredentials], function* ({ startRefusal, opened }) {
	const result = yield* startRefusal();

	expect(result).toMatchObject({
		outcome: "rejected",
		reason: "Pi offers no model (default) with credentials; choose provider/model-id from its catalog",
	});
	expect(yield* opened()).toEqual([]);
});

pi.it("an invalid thinking level is refused before session creation", [], function* ({ startRefusal, opened }) {
	const result = yield* startRefusal(undefined, "extreme");

	expect(result).toMatchObject({ outcome: "rejected", reason: expect.stringContaining("effort extreme is not a thinking level") });
	expect(yield* opened()).toEqual([]);
});

pi.it("an unpersisted SDK session is refused and released", [noSessionFile], function* ({ startRefusal, released }) {
	const result = yield* startRefusal();

	expect(result).toEqual({ outcome: "rejected", reason: "Pi opened a session without a persisted session file" });
	expect(yield* released()).toEqual({ aborted: 1, disposed: 1, listeners: 0 });
});

for (const feature of ["imageInput", "transcript"] as const) {
	pi.it(`${feature} is refused by negotiation before Pi opens a session`, [], function* ({ unsupported, opened }) {
		const result = yield* unsupported(feature);

		expect(result).toEqual({ outcome: "unsupported", requirement: feature });
		expect(yield* opened()).toEqual([]);
	});
}

pi.it("additional skill paths reach Pi's resource loader", [], function* ({ start, resources }) {
	yield* start();

	expect(yield* resources()).toMatchObject([{ additionalSkillPaths: ["/application/skills"] }]);
});

pi.it(
	"resume refuses a missing session file before opening replacement work",
	[],
	function* ({ start, dispose, loseSessionFile, restart, resumeRefusal, opened }) {
		const receipt = yield* start();
		yield* dispose();
		yield* loseSessionFile();
		yield* restart();

		const result = yield* resumeRefusal();

		expect(result).toMatchObject({ outcome: "rejected", reason: expect.stringContaining("ENOENT") });
		expect(yield* opened()).toMatchObject([{ file: receipt.session?.value }]);
	},
);

pi.it("an omitted model selects the first credential-backed model", [], function* ({ start, opened }) {
	yield* start();

	expect((yield* opened())[0]).toMatchObject({ model: { id: "sonnet", provider: "anthropic" } });
});
