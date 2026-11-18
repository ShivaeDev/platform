import { Context, Option } from "effect";
import type { Rpc } from "effect/rpc";
import { expect, it } from "vitest";
import type { ClientMatchesModule } from "#clientMatchesModule.ts";
import { LiveSync } from "#LiveSync.ts";
import { LIVE_SYNC, liveSyncRpc } from "#liveSyncRpc.ts";
import { CommandInvalidation } from "#serverMetadata.ts";

function shapes(requests: ReadonlyMap<string, Rpc.AnyWithProps>) {
	return [...requests].map(([tag, rpc]) => ({
		command: Option.isSome(Context.getOption(rpc.annotations, CommandInvalidation)),
		error: rpc.errorSchema.ast,
		middlewares: rpc.middlewares.size,
		payload: rpc.payloadSchema.ast,
		success: rpc.successSchema.ast,
		tag,
	}));
}

const TYPES_MATCH: ClientMatchesModule<typeof liveSyncRpc, typeof LiveSync.application> = true;

it("the browser's sync command has the tag, schemas and command annotation of the host's contract", () => {
	expect(shapes(liveSyncRpc.requests)).toEqual(shapes(LiveSync.application.requests));
	expect(shapes(liveSyncRpc.requests)).toMatchObject([{ command: true, tag: LIVE_SYNC }]);
	expect(TYPES_MATCH).toBe(true);
});
