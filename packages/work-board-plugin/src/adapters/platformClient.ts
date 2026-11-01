import { Effect } from "effect";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { browserClient, type Reader } from "@shivaedev/work-board/adapters/browserClient.ts";
import { hostProtocol, type Post } from "#adapters/hostProtocol.ts";
import { readSnapshot } from "#board.ts";
import type { Board } from "#boardTools.ts";
import { BOARD_ORIGIN, isRecord, text } from "#rpc.ts";

function problemOf(error: unknown): Error {
	if (error instanceof RpcClientError) {
		return new Error(error.reason.message, { cause: error });
	}
	return error instanceof Error ? error : new Error(String(error));
}

export function platformClient(directory: string, post: Post, now: () => Promise<number>) {
	const client = browserClient(BOARD_ORIGIN, { live: false, protocol: hostProtocol(post) });
	function run<A, E>(effect: Effect.Effect<A, E, Reader>) {
		return client.run(effect).catch((error: unknown) => Promise.reject(problemOf(error)));
	}
	const ask: Board["ask"] = (requests) =>
		Promise.all(
			requests.map((request) => {
				switch (request.tag) {
					case "work-board.inbox":
						return run(client.api.inbox.run(undefined));
					case "work-board.overview":
						return run(client.api.overview.run(undefined));
					case "work-board.fleetItems":
						return run(client.api.fleetItems.run(undefined));
					case "work-board.server":
						return run(client.api.server.run(undefined));
					case "work-board.document": {
						const documentUrl = isRecord(request.payload) ? text(request.payload.url) : undefined;
						if (documentUrl !== undefined) {
							return run(client.api.document.run({ url: documentUrl }));
						}
					}
				}
				return Promise.reject(new Error(`The Work Board for ${directory} cannot read ${request.tag}.`));
			}),
		);
	return {
		ask,
		board: () =>
			run(
				Effect.all(
					{ inbox: client.api.inbox.run(undefined), overview: client.api.overview.run(undefined), server: client.api.server.run(undefined) },
					{ concurrency: "unbounded" },
				),
			).then(async (values) => readSnapshot(values, await now())),
		close: () => client.registry.dispose(),
	};
}
