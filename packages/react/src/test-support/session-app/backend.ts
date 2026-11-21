import { Effect, Layer, Schema } from "effect";
import { RpcGroup } from "effect/rpc";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import { type Backend, Counter } from "#test/client-app/backend.ts";

// The diary is readable only with a session, so a signed-out read answers Unauthorized.
export const Diary = contract("diary", {
	queries: [query("entries", { readPolicy: () => Effect.succeed(true), reads: () => [], rejections: { Unauthorized }, success: Schema.String })],
});

export interface SessionBackend extends Backend {
	diaryReads: number;
}

export function sessionBackendProtocol(backend: SessionBackend) {
	const handlers = Layer.merge(
		Counter.application.toLayer({
			"counter.bump": () =>
				Effect.sync(() => {
					backend.count += 1;
				}),
			"counter.count": () =>
				Effect.sync(() => {
					backend.countReads += 1;
					return backend.count;
				}),
		}),
		Diary.application.toLayer({
			"diary.entries": () =>
				Effect.suspend(() => {
					backend.diaryReads += 1;
					return Effect.fail(new Unauthorized({ message: "Sign in to read the diary" }));
				}),
		}),
	);
	return layerLiveMemoryProtocol(RpcGroup.make().merge(Counter, Diary), handlers);
}
