import { join } from "node:path";
import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { RpcSerialization } from "effect/rpc";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { localRpcGuard } from "@shivaedev/platform/rpc-server/local.ts";
import { type Folder, folder, rawPost, startBoard } from "#test/board.ts";
import { socketRpc } from "#test/socketRpc.ts";

let notes: Folder;
afterEach(() => notes?.remove());

it.live("accepts localhost RPC on the socket while TCP retains its Host and peer checks", function* () {
	notes = folder({ "note.md": "# Notes\n" });
	const board = yield* startBoard(notes.root);
	const info = { directory: notes.root, url: `${board.url}/` };
	for (const address of [join(notes.root, "board.sock"), board.url]) {
		expect(yield* Effect.promise(() => socketRpc(address, "work-board.server"))).toEqual(
			expect.arrayContaining([expect.objectContaining({ _tag: "Exit", exit: { _tag: "Success", value: info } })]),
		);
	}
	const message = `${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag: "work-board.server" })}\n`;
	expect((yield* rawPost(board, "/_board/rpc", { "content-type": "application/ndjson", host: "untrusted.example" }, message)).status).toBe(403);
	for (const address of [undefined, "203.0.113.9", "127.999.0.1", "127.0.0.1"]) {
		const request = HttpServerRequest.fromWeb(
			new Request("http://localhost/_board/rpc", { headers: { "content-type": "application/ndjson", host: "localhost" } }),
		).modify({ remoteAddress: Option.fromNullishOr(address) });
		let calls = 0;
		const response = yield* localRpcGuard(
			Effect.sync(() => {
				calls += 1;
				return HttpServerResponse.empty();
			}),
		).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request), Effect.provide(RpcSerialization.layerNdjson));
		expect(response.status).toBe(address === "127.0.0.1" ? 204 : 403);
		expect(calls).toBe(address === "127.0.0.1" ? 1 : 0);
	}
});
