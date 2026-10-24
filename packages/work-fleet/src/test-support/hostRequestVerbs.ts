import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { daemonRequest } from "#host/daemonClient.ts";
import { requestServer } from "#test/requestServer.ts";

export function hostRequestVerbs() {
	return {
		answerPeer: (port: number, timeoutMs?: number, transportTimeout = false) =>
			daemonRequest(port, (client) => client("daemon.answer", { workId: "one" }), "answer one", timeoutMs).pipe(
				Effect.provideService(FetchHttpClient.Fetch, (input, options) =>
					fetch(input, { ...options, ...(transportTimeout ? { signal: AbortSignal.timeout(100) } : {}) }),
				),
			),
		requestPeer: (status?: number) => requestServer(status),
	};
}
