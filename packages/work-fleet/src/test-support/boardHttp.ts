import { createServer } from "node:http";
import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { Effect, Layer, ManagedRuntime } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { browserClient } from "@shivaedev/work-board/browserClient.ts";
import { boardLayer } from "@shivaedev/work-board/server/board.ts";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";

export const boardHttp = Effect.fn("BoardStory.boardHttp")(function* (root: string, home?: string, maintainer?: string, fleetPort?: number) {
	const runtime = ManagedRuntime.make(
		HttpRouter.serve(boardLayer({ ...(fleetPort === undefined ? {} : { fleetPort }), home, maintainer, responses: true, root }), {
			disableLogger: true,
		}).pipe(
			Layer.provideMerge(NodeHttpServer.layer(createServer, { disablePreemptiveShutdown: true, host: "127.0.0.1", port: 0 })),
			Layer.provide(NodeServices.layer),
		),
	);
	yield* Effect.addFinalizer(() => Effect.promise(() => runtime.dispose()));
	const server = yield* Effect.promise(() => runtime.runPromise(Effect.service(HttpServer.HttpServer)));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die(new Error("Board did not listen on TCP."));
	}
	const url = `http://${NetAddress.formatIp(server.address.address)}:${server.address.port}`;
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
		return ["responses", ".board-settled"].flatMap((directory) =>
			(existsSync(join(root, directory)) ? readdirSync(join(root, directory)) : [])
				.filter((file) => file.startsWith("request-receipt.") && file.endsWith(".md"))
				.map((file) => `${directory}/${file}`),
		);
	}
	return { move, read, receiptRecords: () => receipts().map((file) => metadataParse(read(file)).fields.requestReceipt), receipts, write };
}

export const boardAskFiles = Effect.fn("BoardStory.boardAskFiles")(function* (root: string, maintainer?: string) {
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const { client } = yield* boardHttp(root, undefined, maintainer);
			const data = yield* Effect.tryPromise(() => client.run(client.api.inbox.run(undefined)));
			return [...data.you, ...data.answered, ...data.agents, ...data.resolved, ...data.parked].map((item) => item.file);
		}),
	);
});

import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as NetAddress from "effect/net/NetAddress";
