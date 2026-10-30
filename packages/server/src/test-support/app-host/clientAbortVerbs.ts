import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Predicate } from "effect";
import { SqlClient } from "effect/sql";
import { words } from "#test/answers.ts";
import { type ClientAbortState, observed } from "./clientAbortFixture.ts";
import { type HostState, io } from "./state.ts";
import { attributesOf } from "./traceVerbs.ts";
import { wireAnswers } from "./wireAnswers.ts";

const SERVER_KIND = 2;
const RESYNC_KEY = /^@shivaedev\/contract\/resync\//u;

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
function call(state: HostState, method: "rows" | "commit") {
	return io(async () => wireAnswers(await (await rpcFetch(state, method, AbortSignal.timeout(5000))).text())["0"]);
}
function hintKind(chunk: string): string {
	const message: unknown = JSON.parse(chunk.trim().split("\n")[0] ?? "null");
	const [hint] = Predicate.hasProperty(message, "values") && Array.isArray(message.values) ? message.values : [];
	return Predicate.hasProperty(hint, "_tag") ? words(String(hint._tag)) : `unreadable hint ${chunk}`;
}
function begin(state: HostState, method: "hold" | "watch") {
	const probe = probeOf(state);
	probe.response = rpcFetch(state, method, probe.controller.signal);
	void probe.response.catch(() => undefined);
	return probe;
}
export function clientAbortVerbs(state: HostState, tell: (line: string) => void) {
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	function nextHint() {
		return io(async () => {
			const response = await probeOf(state).response;
			reader ??= response?.body?.getReader();
			const chunk = await reader?.read();
			return hintKind(new TextDecoder().decode(chunk?.value));
		});
	}
	return {
		browserAborts: () => {
			tell("the browser aborts its fetch");
			return io(() => {
				const probe = probeOf(state);
				probe.controller.abort();
				return observed(probe, () => probe.finalized && probe.registrations.length === 0);
			});
		},
		commitChange: () => {
			tell("the browser calls commit, which stores a row and invalidates the subscribed list");
			const probe = probeOf(state);
			const commits = probe.commits;
			return Effect.andThen(
				call(state, "commit"),
				io(() => observed(probe, () => probe.commits > commits)),
			);
		},
		completedRpc: () => {
			tell("the browser calls rows over HTTP, which completes");
			return Effect.asVoid(call(state, "rows"));
		},
		connectionStates: () =>
			Effect.gen(function* () {
				const url = yield* Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL");
				const rows = yield* SqlClient.SqlClient.use(
					(sql) => sql<{ state: string }>`select state from pg_stat_activity where application_name = ${probeOf(state).applicationName}`,
				).pipe(Effect.provide(PgClient.layer({ url })));
				return rows.map((row) => row.state);
			}),
		failureLogs: () =>
			Effect.sync(() =>
				state.logs
					.filter(({ message }) => String(message).includes("RPC failure") || String(message).includes("RPC defect"))
					.map(({ annotations }) => annotations["rpc.method"]),
			),
		handlerEnding: () =>
			Effect.sync(() => {
				const probe = probeOf(state);
				if (!probe.finalized) {
					return "still running";
				}
				return probe.interrupted ? "interrupted" : "completed";
			}),
		holdTransaction: () => {
			tell("the browser starts the hold RPC, whose handler writes a row in a transaction and waits");
			return io(() => {
				const probe = begin(state, "hold");
				return observed(probe, () => probe.written);
			});
		},
		interruptionLogs: () =>
			Effect.sync(() =>
				state.logs
					.filter(({ message }) => String(message).includes("RPC interrupted"))
					.map(({ annotations, level, spans }) => ({ annotations, duration: spans?.["rpc.duration"] === undefined ? "missing" : "recorded", level })),
			),
		nextHint: () => {
			tell("the subscription's next live hint arrives");
			return nextHint();
		},
		openWatch: () => {
			tell("the browser opens the watch subscription over HTTP");
			return Effect.andThen(
				Effect.sync(() => begin(state, "watch")),
				nextHint(),
			);
		},
		rpcSpanMarks: () =>
			Effect.sync(() =>
				Object.fromEntries(
					(state.receiver?.spans ?? [])
						.filter((span) => span.kind === SERVER_KIND && ["commit", "hold", "rows", "watch"].includes(span.name))
						.map((span) => [span.name, attributesOf(span.attributes)["rpc.interrupted"] === true ? "interrupted" : "completed"]),
				),
			),
		storedRows: () =>
			Effect.map(call(state, "rows"), (answer) =>
				Predicate.hasProperty(answer, "succeeded") && Array.isArray(answer.succeeded)
					? answer.succeeded.map((row: unknown) => (Predicate.hasProperty(row, "value") ? row.value : row))
					: answer,
			),
		subscriptionCallbacks: () => Effect.sync(() => probeOf(state).callbacks),
		subscriptionRegistrations: () =>
			Effect.sync(() =>
				probeOf(state).registrations.map((keys) =>
					(Array.isArray(keys) ? keys : Object.values(keys).flat()).map((key) => (RESYNC_KEY.test(String(key)) ? "a resync key" : String(key))),
				),
			),
	};
}
