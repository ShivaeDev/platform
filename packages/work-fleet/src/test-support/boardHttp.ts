import { createServer } from "node:http";
import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { Effect, Layer, ManagedRuntime } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { boardLayer } from "@shivaedev/work-board/board.ts";
import { browserClient } from "@shivaedev/work-board/browser/client.ts";

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
		return readdirSync(join(root, "responses"))
			.filter((file) => file.startsWith("request-receipt."))
			.map((file) => `responses/${file}`);
	}
	return { move, read, receipts, write };
}

export const boardOverview = Effect.fn("BoardStory.boardOverview")((root: string) => boardPage(root, "overview"));
export const boardInbox = Effect.fn("BoardStory.boardInbox")((root: string, maintainer?: string) => boardPage(root, "inbox", maintainer));

function boardPage(root: string, view: string, maintainer?: string) {
	return Effect.scoped(
		Effect.gen(function* () {
			const { url } = yield* boardHttp(root, undefined, maintainer);
			const page = yield* Effect.tryPromise(() => fetch(`${url}/_board/${view}`));
			const html = yield* Effect.tryPromise(() => page.text());
			const content = /<template id="board-legacy-page">(?<content>[\s\S]*?)<\/template>/u.exec(html)?.groups?.content;
			if (content === undefined) {
				return yield* Effect.die(new Error("Board did not return its page content."));
			}
			return content;
		}),
	);
}

import { readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as NetAddress from "effect/net/NetAddress";
