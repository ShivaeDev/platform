import { Effect } from "effect";
import { RpcTest } from "effect/rpc";
import { workRpcs } from "#rpc/contract.ts";
import type { BoardFixtureOptions } from "./BoardFixtureOptions.ts";
import { BoardWorkspace } from "./workspaceBoard.ts";

// Delay or fail delivery at the browser client's transport adapter while the Board handlers stay real.
export const screenTransport = Effect.fn("Test.screenTransport")(function* (options?: BoardFixtureOptions) {
	yield* options?.beforeStart ?? Effect.void;
	const workspace = yield* BoardWorkspace;
	const client = yield* RpcTest.makeClient(workRpcs, { flatten: true });
	return new Proxy(client, {
		apply(target, receiver, args: [string, { readonly url?: string } | undefined, ...unknown[]]) {
			const [tag, payload] = args;
			const url = payload?.url;
			const read = Reflect.apply(target, receiver, args);
			if (tag.endsWith(".$changes")) {
				return read;
			}
			return Effect.suspend(() => options?.beforeRequest?.(workspace.paths()) ?? Effect.void).pipe(
				Effect.andThen(url ? (options?.beforeRead?.("document", url) ?? Effect.void) : Effect.void),
				Effect.andThen(workspace.synchronize),
				Effect.andThen(read),
				Effect.tap(() => (url ? (options?.afterRead?.(url) ?? Effect.void) : Effect.void)),
			);
		},
	});
});
