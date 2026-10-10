import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { SessionTransport } from "#session/service.ts";
import { codexConfiguration, codexServer, requestCursor } from "#test/codex.ts";

const receipt = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
it.live("uses acknowledged IDs and caches terminal evidence; closing an observer never interrupts", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const methods: string[] = [];
			const fixture = yield* codexServer((request) => {
				methods.push(request.method);
				if (request.method === "thread/start") {
					return { thread: { id: receipt.sessionId } };
				}
				if (request.method === "turn/start") {
					return { turn: { id: receipt.turnId } };
				}
				if (request.method === "thread/turns/list") {
					return { data: [{ id: receipt.turnId, items: [], status: "completed" }], nextCursor: null };
				}
				if (request.method === "thread/items/list") {
					return { data: [{ item: { id: "message", text: "Evidence", type: "agentMessage" } }], nextCursor: null };
				}
				return {};
			});
			yield* Effect.gen(function* () {
				const provider = yield* SessionTransport;
				const sessionId = yield* provider.startSession({ cwd: "/synthetic", operationId: "operation", prompt: "work" });
				expect(sessionId).toBe(receipt.sessionId);
				expect(yield* provider.startTurn({ operationId: "operation", prompt: "work", sessionId })).toEqual(receipt);
				expect((yield* provider.observe(receipt)).output).toBe("Evidence");
				yield* provider.observe(receipt);
			}).pipe(Effect.provide(codexConfiguration(fixture.endpoint)));
			expect(methods.filter((method) => method === "thread/turns/list")).toHaveLength(1);
			expect(methods.filter((method) => method === "thread/items/list")).toHaveLength(1);
			expect(methods).not.toContain("thread/resume");
			expect(methods).not.toContain("turn/interrupt");
		}),
	),
);
it.live("reconciles across all pages and refuses ambiguous duplicate operations", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const methods: string[] = [];
			const fixture = yield* codexServer((request) => {
				methods.push(request.method);
				if (request.method !== "thread/turns/list") {
					return {};
				}
				const cursor = requestCursor(request);
				return {
					data: [
						{
							id: cursor === "second" ? "second-turn" : "first-turn",
							items: [{ clientId: "operation", id: "input", type: "userMessage" }],
							status: "completed",
						},
					],
					nextCursor: cursor === "second" ? null : "second",
				};
			});
			const result = yield* Effect.gen(function* () {
				const provider = yield* SessionTransport;
				return yield* provider.reconcile({ operationId: "operation", sessionId: receipt.sessionId }).pipe(Effect.flip);
			}).pipe(Effect.provide(codexConfiguration(fixture.endpoint)));
			expect(result.reason).toBe("ambiguous");
			expect(methods.filter((method) => method === "thread/turns/list")).toHaveLength(2);
			expect(methods).not.toContain("turn/start");
		}),
	),
);
it.live("adopts an existing acknowledged turn after restart and requires explicit interrupt acknowledgement", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const methods: string[] = [];
			const fixture = yield* codexServer((request) => {
				methods.push(request.method);
				if (request.method === "thread/turns/list") {
					return { data: [{ id: receipt.turnId, items: [], status: "inProgress" }], nextCursor: null };
				}
				return {};
			});
			yield* Effect.gen(function* () {
				const provider = yield* SessionTransport;
				expect(yield* provider.reconcile({ operationId: "operation", ...receipt })).toEqual(receipt);
				expect((yield* provider.observe(receipt)).execution).toBe("running");
				expect(yield* provider.interrupt(receipt)).toEqual(receipt);
			}).pipe(Effect.provide(codexConfiguration(fixture.endpoint)));
			expect(methods).not.toContain("turn/start");
			expect(methods).not.toContain("thread/items/list");
			expect(methods.filter((method) => method === "turn/interrupt")).toHaveLength(1);
		}),
	),
);
it.live("retains a lost turn response and reconciles its operation without a second submission", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const methods: string[] = [];
			const fixture = yield* codexServer((request) => {
				methods.push(request.method);
				if (request.method === "thread/start") {
					return { thread: { id: receipt.sessionId } };
				}
				if (request.method === "turn/start") {
					return undefined;
				}
				if (request.method === "thread/turns/list") {
					return {
						data: [{ id: receipt.turnId, items: [{ clientId: "operation", id: "input", type: "userMessage" }], status: "inProgress" }],
						nextCursor: null,
					};
				}
				return {};
			});
			yield* Effect.gen(function* () {
				const provider = yield* SessionTransport;
				const sessionId = yield* provider.startSession({ cwd: "/synthetic", operationId: "operation", prompt: "work" });
				expect((yield* provider.startTurn({ operationId: "operation", prompt: "work", sessionId }).pipe(Effect.flip)).reason).toBe("ambiguous");
				expect(yield* provider.reconcile({ operationId: "operation", sessionId })).toEqual(receipt);
			}).pipe(Effect.provide(codexConfiguration(fixture.endpoint)));
			expect(methods.filter((method) => method === "turn/start")).toHaveLength(1);
		}),
	),
);
