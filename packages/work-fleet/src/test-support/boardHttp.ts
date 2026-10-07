import { NodeServices } from "@effect/platform-node";
import { Effect, Layer, ManagedRuntime } from "effect";
import { HttpServer } from "effect/unstable/http";
import { browserClient } from "@shivaedev/work-board/browser/client.ts";
import { serveBoard } from "@shivaedev/work-board/serve.ts";

export const boardHttp = Effect.fn("BoardStory.boardHttp")(function* (root: string) {
	const runtime = ManagedRuntime.make(serveBoard({ port: 0, responses: true, root }).pipe(Layer.provide(NodeServices.layer)));
	yield* Effect.addFinalizer(() => Effect.promise(() => runtime.dispose()));
	const server = yield* Effect.promise(() => runtime.runPromise(Effect.service(HttpServer.HttpServer)));
	if (server.address._tag !== "TcpAddress") {
		return yield* Effect.die(new Error("Board did not listen on TCP."));
	}
	const url = `http://${server.address.hostname}:${server.address.port}`;
	const client = browserClient(url);
	yield* Effect.addFinalizer(() => Effect.sync(() => client.registry.dispose()));
	return { client, url };
});

export function boardHttpFiles(root: string) {
	function read(file: string) {
		return readFileSync(join(root, file), "utf8");
	}
	function write(file: string, content: string) {
		writeFileSync(join(root, file), content);
	}
	function move(from: string, to: string) {
		renameSync(join(root, from), join(root, to));
	}
	function receipts() {
		return readdirSync(join(root, "responses"))
			.filter((file) => file.startsWith("request-receipt."))
			.map((file) => `responses/${file}`);
	}
	return { move, read, receipts, write };
}

export const boardOverview = Effect.fn("BoardStory.boardOverview")((root: string) =>
	Effect.scoped(
		Effect.gen(function* () {
			const { url } = yield* boardHttp(root);
			const page = yield* Effect.tryPromise(() => fetch(`${url}/_board/overview`));
			return yield* Effect.tryPromise(() => page.text());
		}),
	),
);

import { readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
