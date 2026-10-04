import { Effect, Layer, Path } from "effect";
import { expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test";
import { codexAgentLayer } from "#codex.ts";
import { CodexRpc } from "#codexRpc.ts";
import { Agent, failure } from "#ports.ts";
import { acknowledged, codexFilesystem, launchResponse, noChange, request, rpc, thread } from "#test/support/codexFixtures.ts";

const { effectApp } = makeEffectIt({ layer: Layer.succeed(CodexRpc, rpc(launchResponse)), makeHarness: () => Effect.void });
function using<A, E>(effect: Effect.Effect<A, E, Agent>, service: typeof CodexRpc.Service) {
	return effect.pipe(
		Effect.provide(codexAgentLayer().pipe(Layer.provide(Layer.mergeAll(Layer.succeed(CodexRpc, service), codexFilesystem, Path.layer)))),
	);
}
effectApp("persists the thread before submission and the actual turn acknowledgement after it", function* () {
	const events: string[] = [];
	const result = yield* using(
		Effect.gen(function* () {
			const agent = yield* Agent;
			return yield* agent.launch(request, (ref) =>
				Effect.sync(() => {
					events.push(`saved:${ref.turnId ?? ref.sessionId}`);
				}),
			);
		}),
		rpc(launchResponse, events),
	);
	expect(events).toEqual(["account/read", "config/read", "thread/start", "saved:thread-example", "turn/start", "saved:turn-example"]);
	expect(result).toEqual({ ref: { sessionId: "thread-example", turnId: "turn-example" }, status: "pending" });
});
effectApp("never starts a turn after a failed durable thread acknowledgement", function* () {
	const events: string[] = [];
	const result = yield* using(
		Effect.gen(function* () {
			return yield* (yield* Agent).launch(request, () => Effect.fail(failure("disk unavailable")));
		}),
		rpc(launchResponse, events),
	).pipe(Effect.result);
	expect(result._tag).toBe("Failure");
	expect(events).toEqual(["account/read", "config/read", "thread/start"]);
});
effectApp("repairs resume the original worker with sandbox restrictions", function* () {
	const calls: Array<{
		method: string;
		params: unknown;
	}> = [];
	yield* using(
		Effect.gen(function* () {
			return yield* (yield* Agent).launch(acknowledged(), () => Effect.void);
		}),
		rpc((method, params) => {
			calls.push({ method, params });
			return launchResponse(method);
		}),
	);
	expect(calls[2]).toMatchObject({ method: "thread/resume", params: { approvalPolicy: "never", threadId: "thread-example" } });
	expect(calls[2]).toMatchObject({
		params: {
			config: {
				"default_permissions": "work-fleet",
				permissions: {
					"work-fleet": { filesystem: { [request.work.checkout]: "write", [`${request.work.checkout}/.git`]: "write" }, network: { enabled: false } },
				},
			},
		},
	});
});
effectApp("reviewers get read-only execution without network or permission approvals", function* () {
	const calls: unknown[] = [];
	yield* using(
		Effect.gen(function* () {
			return yield* (yield* Agent).launch({ ...request, attempt: { ...request.attempt, role: "reviewer" } }, () => Effect.void);
		}),
		rpc((method, params) => {
			calls.push(params);
			return launchResponse(method);
		}),
	);
	expect(calls[2]).toMatchObject({
		approvalPolicy: "never",
		config: { permissions: { "work-fleet": { filesystem: { ":root": "read" }, network: { enabled: false } } } },
	});
});
effectApp("recovers an uncertain acknowledgement by exact attempt marker without submitting again", function* () {
	const events: string[] = [];
	const uncertain = { ...request, attempt: { ...request.attempt, ref: { sessionId: "thread-example", turnId: null } } };
	const observed = yield* using(
		Effect.gen(function* () {
			return yield* (yield* Agent).observe(uncertain);
		}),
		rpc(() => thread(), events),
	);
	expect(observed).toEqual({ ref: { sessionId: "thread-example", turnId: "turn-example" }, result: noChange, status: "completed" });
	expect(events).toEqual(["thread/read"]);
});
effectApp("completed turns need a schema-valid result and interrupted turns never deliver", function* () {
	for (const [status, text] of [
		["interrupted", JSON.stringify(noChange)],
		["completed", "Everything looks good"],
	]) {
		const result = yield* using(
			Effect.gen(function* () {
				return yield* (yield* Agent).observe(acknowledged());
			}),
			rpc(() => thread(status, text)),
		).pipe(Effect.result);
		expect(result._tag === "Failure" || result.success.status === "failed").toBe(true);
	}
});
effectApp("missing turns and missing executors are unknown, not replacement authorization", function* () {
	for (const response of [
		{ thread: { id: "thread-example", status: { type: "idle" }, turns: [] } },
		{ thread: { ...thread("inProgress").thread, status: { type: "notLoaded" } } },
	]) {
		const observed = yield* using(
			Effect.gen(function* () {
				return yield* (yield* Agent).observe(acknowledged());
			}),
			rpc(() => response),
		);
		expect(observed.status).toBe("unknown");
	}
});
effectApp("refuses API-key billing before creating a thread", function* () {
	const events: string[] = [];
	const result = yield* using(
		Effect.gen(function* () {
			return yield* (yield* Agent).launch(request, () => Effect.void);
		}),
		rpc(() => ({ account: { type: "apiKey" } }), events),
	).pipe(Effect.result);
	expect(result._tag).toBe("Failure");
	expect(events).toEqual(["account/read"]);
});
effectApp("refuses enabled inherited MCP servers before creating any thread", function* () {
	const events: string[] = [];
	const result = yield* using(
		Effect.gen(function* () {
			return yield* (yield* Agent).launch(request, () => Effect.void);
		}),
		rpc((method) => (method === "config/read" ? { config: { "mcp_servers": { external: { enabled: true } } } } : launchResponse(method)), events),
	).pipe(Effect.result);
	expect(result._tag).toBe("Failure");
	if (result._tag === "Failure") {
		expect(result.failure.disposition).toBe("human");
	}
	expect(events).toEqual(["account/read", "config/read"]);
});
