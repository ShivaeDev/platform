import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { codexServer, WireRejection } from "#test/codex.ts";
import { connect, request } from "./codexRpc.ts";

it.live("preserves a structured capacity rejection through the actual provider WebSocket boundary", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const fixture = yield* codexServer(() => new WireRejection("Synthetic provider capacity", { codexErrorInfo: "serverOverloaded" }));
			const connection = yield* connect({ url: new URL(fixture.endpoint) }, 1000);
			const error = yield* request(connection, 1000, "turn/start", {}, true).pipe(Effect.flip);
			expect(error).toMatchObject({
				capacity: "serverOverloaded",
				message: "Codex rejected the protocol request: Synthetic provider capacity",
				reason: "rejected",
			});
		}),
	),
);

for (const message of ["App-server request queue is full. Please retry.", "No execution slots are available."]) {
	it.live(`the overload protocol code identifies capacity regardless of wording: ${message}`, () =>
		Effect.scoped(
			Effect.gen(function* () {
				const fixture = yield* codexServer(() => new WireRejection(message, undefined, -32_001));
				const connection = yield* connect({ url: new URL(fixture.endpoint) }, 1000);
				const error = yield* request(connection, 1000, "turn/start", {}, true).pipe(Effect.flip);
				expect(error).toMatchObject({ code: "session-queue-full", message: `Codex rejected the protocol request: ${message}`, reason: "rejected" });
			}),
		),
	);
}

it.live("queue-full wording with another protocol code remains an ordinary rejection", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const fixture = yield* codexServer(() => new WireRejection("App-server request queue is full. Please retry."));
			const connection = yield* connect({ url: new URL(fixture.endpoint) }, 1000);
			expect(yield* request(connection, 1000, "turn/start", {}, true).pipe(Effect.flip)).toMatchObject({
				code: "session-rejected",
				reason: "rejected",
			});
		}),
	),
);
