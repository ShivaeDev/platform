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
