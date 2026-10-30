import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { browserClient } from "@shivaedev/work-board/browserClient.ts";
import { readSnapshot } from "#board.ts";
import type { Board } from "#boardTools.ts";
import { isRecord, text } from "#rpc.ts";

export function platformClient(
	url: string,
	directory: string,
	now: () => Promise<number>,
	changed: (board: ReturnType<typeof readSnapshot>) => void,
) {
	const client = browserClient(url);
	const queries = { inbox: client.api.inbox.query(), overview: client.api.overview.query(), server: client.api.server.query() };
	function publish() {
		const inbox = client.registry.get(queries.inbox);
		const overview = client.registry.get(queries.overview);
		const server = client.registry.get(queries.server);
		if (!(AsyncResult.isSuccess(inbox) && AsyncResult.isSuccess(overview) && AsyncResult.isSuccess(server))) {
			return;
		}
		void client.run(
			Effect.gen(function* () {
				const stamp = yield* Effect.promise(now);
				changed(readSnapshot({ inbox: inbox.value, overview: overview.value, server: server.value }, stamp));
			}),
		);
	}
	const releases = [
		client.registry.subscribe(queries.inbox, publish, { immediate: true }),
		client.registry.subscribe(queries.overview, publish, { immediate: true }),
		client.registry.subscribe(queries.server, publish, { immediate: true }),
	];
	const ask: Board["ask"] = (requests) =>
		Promise.all(
			requests.map((request) => {
				switch (request.tag) {
					case "work-board.inbox":
						return client.run(client.api.inbox.run(undefined));
					case "work-board.overview":
						return client.run(client.api.overview.run(undefined));
					case "work-board.fleetItems":
						return client.run(client.api.fleetItems.run(undefined));
					case "work-board.server":
						return client.run(client.api.server.run(undefined));
					case "work-board.document": {
						const documentUrl = isRecord(request.payload) ? text(request.payload.url) : undefined;
						if (documentUrl !== undefined) {
							return client.run(client.api.document.run({ url: documentUrl }));
						}
					}
				}
				return Promise.reject(new Error(`The Work Board for ${directory} cannot read ${request.tag}.`));
			}),
		);
	return {
		ask,
		close: () => {
			for (const release of releases) {
				release();
			}
			client.registry.dispose();
		},
		refresh: () => {
			client.registry.refresh(queries.inbox);
			client.registry.refresh(queries.overview);
			client.registry.refresh(queries.server);
		},
	};
}
