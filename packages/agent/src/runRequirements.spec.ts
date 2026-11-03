import { expect } from "@effect/vitest";
import { agent, failedRead, lostAcknowledgement, missingEvidence, providerEvents, rejectionProof, supporting } from "#test/agentStory.ts";

for (const requirement of ["steering", "transcript", "sessions", "imageInput", "interruption", "models", "queuedInput"] as const) {
	agent.it(
		`an unmet ${requirement} requirement names the backend and available features before provider calls`,
		[],
		function* ({ request, providerCalls }) {
			const result = yield* request([requirement]);

			expect(result).toMatchObject({
				available: { features: { [requirement]: { support: "unsupported" } } },
				backend: "scripted",
				outcome: "unsupported",
				requirement,
			});
			expect(yield* providerCalls()).toEqual([]);
		},
	);
}

agent.it(
	"a supported requirement does not bypass a later unsupported requirement",
	[supporting("queuedInput")],
	function* ({ request, providerCalls }) {
		const result = yield* request(["queuedInput", "steering"]);

		expect(result).toMatchObject({ outcome: "unsupported", requirement: "steering" });
		expect(yield* providerCalls()).toEqual([]);
	},
);

agent.it(
	"steering reaches the steering implementation without queueing input",
	[supporting("steering", "queuedInput")],
	function* ({ steer, providerCalls }) {
		yield* steer();

		expect(yield* providerCalls()).toMatchObject([
			{ argument: { input: { parts: [{ text: "keep the public API", type: "text" }] } }, method: "steer" },
		]);
	},
);

agent.it("queued input reaches the queue implementation", [supporting("queuedInput")], function* ({ queue, providerCalls }) {
	yield* queue();

	expect(yield* providerCalls()).toMatchObject([
		{ argument: { input: { parts: [{ text: "keep the public API", type: "text" }] } }, method: "queue" },
	]);
});

agent.it("a descriptor exposes feature support without implementations", [supporting("steering")], function* ({ descriptor }) {
	const available = yield* descriptor();

	expect(available.features.steering).toEqual({ support: "supported" });
});

agent.it("start forwards the caller identity and acknowledges without reading completion", [], function* ({ start, providerCalls }) {
	const receipt = yield* start();

	expect(receipt).toMatchObject({ backend: "scripted", operationId: "change", reference: { value: "run:change", version: 1 } });
	expect(yield* providerCalls()).toEqual([
		{ argument: { cwd: "/project", input: { parts: [{ text: "keep the public API", type: "text" }] }, operationId: "change" }, method: "start" },
	]);
});

agent.it(
	"lost acknowledgement preserves the provider code and reconciliation stays uncertain without resubmitting",
	[lostAcknowledgement],
	function* ({ start, reconcile, providerCalls }) {
		const accepted = yield* start();
		expect(accepted).toEqual({ outcome: "unknown acceptance", providerCode: "LOST_ACK" });

		const result = yield* reconcile();

		expect(result).toMatchObject({ operationId: "change", type: "uncertain" });
		expect((yield* providerCalls()).map((call) => call.method)).toEqual(["start", "reconcile"]);
	},
);

agent.it("reconciliation returns the acknowledged receipt without resubmitting", [], function* ({ start, reconcile, providerCalls }) {
	const receipt = yield* start();

	const result = yield* reconcile();

	expect(result).toEqual({ receipt, type: "accepted" });
	expect((yield* providerCalls()).map((call) => call.method)).toEqual(["start", "reconcile"]);
});

agent.it("reconciliation preserves proof of non-acceptance without starting work", [rejectionProof], function* ({ reconcile, providerCalls }) {
	const result = yield* reconcile();

	expect(result).toEqual({ evidence: "operation refused before dispatch", operationId: "change", type: "not-accepted" });
	expect((yield* providerCalls()).map((call) => call.method)).toEqual(["reconcile"]);
});

agent.it("missing execution evidence remains distinct from an execution state", [missingEvidence], function* ({ inspectRun }) {
	const observation = yield* inspectRun();

	expect(observation).toEqual({ reason: "history expired", type: "missing" });
});

agent.it("an unavailable inspect remains a failed read with its provider code", [failedRead], function* ({ inspectRun }) {
	const observation = yield* inspectRun();

	expect(observation).toEqual({ outcome: "read unavailable", providerCode: "OFFLINE" });
});

agent.it(
	"unknown provider events survive as raw events alongside explicit gaps and unreported usage",
	[
		providerEvents([
			{ raw: { kind: "future.event", payload: '{"future":true}', source: "codex" }, type: "raw" },
			{ detail: "child stream ended early", kind: "stream-detached", type: "gap" },
			{ inputTokens: 7, scope: "delta", type: "usage", unit: "turn" },
		]),
	],
	function* ({ readEvents }) {
		const events = yield* readEvents();

		expect(events).toEqual([
			{ raw: { kind: "future.event", payload: '{"future":true}', source: "codex" }, type: "raw" },
			{ detail: "child stream ended early", kind: "stream-detached", type: "gap" },
			{ inputTokens: 7, scope: "delta", type: "usage", unit: "turn" },
		]);
	},
);
