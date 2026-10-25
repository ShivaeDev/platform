import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { ClientAbortState } from "./clientAbortFixture.ts";
import { type HostState, io } from "./state.ts";

function until(observed: () => boolean) {
	return Effect.gen(function* () {
		while (!observed()) {
			yield* Effect.sleep("10 millis");
		}
	}).pipe(Effect.timeout("5 seconds"));
}
function probeOf(state: HostState): ClientAbortState {
	if (state.clientAbort === undefined) {
		throw new Error("An abortable RPC host is required");
	}
	return state.clientAbort;
}
function rpcFetch(state: HostState, method: string, signal: AbortSignal) {
	return fetch(`${state.url}/rpc`, {
		body: `${JSON.stringify({ _tag: "Request", headers: [["x-request-id", `abort-${method}`]], id: "0", payload: method === "hold" || method === "watch" ? { password: "abort-secret" } : null, tag: method })}\n`,
		headers: { "content-type": "application/ndjson" },
		method: "POST",
		signal,
	});
}
export function clientAbortVerbs(state: HostState, tell: (line: string) => void) {
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	return {
		abortClient: () =>
			Effect.sync(() => {
				tell("the browser aborts its fetch");
				probeOf(state).controller.abort();
			}),
		abortProbe: () => {
			const { callbacks, commits, finalized, interrupted, registrations, written } = probeOf(state);
			return { callbacks, commits, finalized, interrupted, registrations, written };
		},
		awaitAbort: () => until(() => probeOf(state).finalized && probeOf(state).registrations === 0),
		awaitCommit: (count: number) => until(() => probeOf(state).commits >= count),
		awaitWrite: () => until(() => probeOf(state).written),
		beginRpc: (method: "hold" | "watch") =>
			Effect.sync(() => {
				tell(`the browser starts the ${method} RPC over HTTP`);
				const probe = probeOf(state);
				probe.response = rpcFetch(state, method, probe.controller.signal);
				void probe.response.catch(() => undefined);
			}),
		nextHint: () =>
			io(async () => {
				const response = await probeOf(state).response;
				reader ??= response?.body?.getReader();
				const chunk = await reader?.read();
				return new TextDecoder().decode(chunk?.value);
			}).pipe(Effect.timeout("5 seconds")),
		poolActivity: () =>
			Effect.gen(function* () {
				const url = yield* Config.Redacted("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
				return yield* SqlClient.SqlClient.use(
					(sql) => sql<{ state: string }>`select state from pg_stat_activity where application_name = ${probeOf(state).applicationName}`,
				).pipe(Effect.provide(PgClient.layer({ url })));
			}),
		rpcResult: (method: "rows" | "commit" | "reject") =>
			io(async () => {
				tell(`the browser calls ${method} over HTTP`);
				const response = await rpcFetch(state, method, AbortSignal.timeout(5000));
				return (await response.text())
					.trim()
					.split("\n")
					.map((line) => JSON.parse(line));
			}),
	};
}
