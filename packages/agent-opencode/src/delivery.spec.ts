import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { openCode } from "#test/opencodeStory.ts";

openCode.it("start sends provider, model and effort through prompt_async", [], function* ({ start, request }) {
	yield* start("alice", "build it", "acme/fast", "careful");

	yield* outcomes([
		["session creation", () => request(), { directory: "/project", method: "POST", path: "/session" }],
		[
			"prompt delivery",
			() => request(),
			{
				body: { model: { "modelID": "fast", "providerID": "acme" }, parts: [{ text: "build it", type: "text" }], variant: "careful" },
				directory: "/project",
				path: "/session/session-1/prompt_async",
			},
		],
	]);
});

openCode.it("queued inputs reach the provider in order after each idle", [], function* ({ start, request, queue, emit, delivered }) {
	yield* start("alice", "first");
	yield* request();
	expect(yield* request()).toMatchObject({ body: { parts: [{ text: "first" }] } });
	yield* queue("alice", "second");
	yield* queue("alice", "third");

	yield* emit("session-1", "session.idle");

	expect(yield* request()).toMatchObject({ body: { parts: [{ text: "second" }] }, path: "/session/session-1/prompt_async" });
	yield* delivered("second");

	yield* emit("session-1", "session.idle");

	expect(yield* request()).toMatchObject({ body: { parts: [{ text: "third" }] }, path: "/session/session-1/prompt_async" });
	yield* delivered("third");
});

openCode.it("active delivery sends immediately and abort targets the same session", [], function* ({ start, request, steer, abort }) {
	yield* start("alice", "first");
	yield* request();
	yield* request();

	yield* steer("alice", "change course");

	expect(yield* request()).toMatchObject({ body: { parts: [{ text: "change course" }] }, path: "/session/session-1/prompt_async" });

	yield* abort("alice");

	expect(yield* request()).toMatchObject({ path: "/session/session-1/abort" });
});

openCode.it("resume reads an existing session before delivering input", [], function* ({ resume, request }) {
	yield* resume("alice", "existing", "continue");

	yield* outcomes([
		["existing session", () => request(), { method: "GET", path: "/session/existing" }],
		["continued input", () => request(), { body: { parts: [{ text: "continue" }] }, path: "/session/existing/prompt_async" }],
	]);
});

openCode.it("models expose provider-qualified names and effort variants", [], function* ({ models }) {
	const choices = yield* models();

	expect(choices).toEqual([{ efforts: ["careful"], id: "acme/fast", isDefault: true, name: "Fast" }]);
});

openCode.it("reconciliation reads an acknowledged receipt and leaves absent evidence uncertain", [], function* ({ start, reconcile }) {
	yield* start("alice", "build it");

	yield* outcomes([
		[
			"acknowledged run",
			() => reconcile("alice"),
			{ receipt: { operationId: "alice", reference: { value: "session-1", version: 1 } }, type: "accepted" },
		],
		["absent evidence", () => reconcile("unknown"), { operationId: "unknown", type: "uncertain" }],
	]);
});
