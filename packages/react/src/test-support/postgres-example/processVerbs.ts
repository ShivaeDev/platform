import { Effect } from "effect";
import { Order } from "./contract.ts";
import { answerWord, hintWord } from "./hintWords.ts";
import { client, type ProcessEngine, process } from "./processEngine.ts";

type Client = "a" | "b" | "another";

const listenerMessages = [
	"PostgreSQL change listener lost; resynchronizing live streams",
	"PostgreSQL change listener recovered; resynchronized live streams",
];

function listenerLogs(engine: ProcessEngine, name: string) {
	return process(engine, name).responses.items.flatMap((response) => {
		if (response._tag !== "Log" || !Array.isArray(response.message)) {
			return [];
		}
		const [message] = response.message;
		if (typeof message !== "string" || !listenerMessages.includes(message)) {
			return [];
		}
		const streams = response.annotations.streamCount;
		return [`${response.level}: ${message}${streams === undefined ? "" : ` (${String(streams)} streams)`}`];
	});
}

export function processVerbs(engine: ProcessEngine, tell: (line: string) => void) {
	function mark() {
		for (const [name, remote] of engine.clients) {
			engine.marks.set(name, remote.hints.items.length);
		}
	}
	function since(name: Client) {
		return client(engine, name).hints.items.slice(engine.marks.get(name) ?? 0);
	}
	function changedSinceMark(...names: readonly Client[]) {
		return Promise.all(names.map((name) => client(engine, name).hints.when(() => since(name).some((hint) => hint._tag === "Changed"))));
	}
	async function save(writer: Client, name: string) {
		engine.answers.push(answerWord(await client(engine, writer).save(name)));
	}
	function recovered(name: string) {
		return process(engine, name).responses.when(() => listenerLogs(engine, name).some((log) => log.includes("recovered")));
	}
	return {
		answers: () => Effect.sync(() => [...engine.answers]),
		hintsSinceAction: (name: Client) => Effect.sync(() => since(name).map(hintWord)),
		initialHints: (name: Client) => Effect.sync(() => client(engine, name).hints.items.map(hintWord)),
		listenerLogs: (name: "first" | "second") => Effect.sync(() => listenerLogs(engine, name)),
		loseListener: () =>
			Effect.gen(function* () {
				tell("the first server loses its PostgreSQL listener; once it recovers, b commits after reconnect");
				mark();
				const listeners = yield* engine.sql<{
					readonly pid: number;
				}>`select pid from pg_stat_activity where application_name = ${engine.configuration.applicationName} and query like 'LISTEN%'`;
				const listener = listeners[0];
				if (listeners.length !== 1 || listener === undefined) {
					return yield* Effect.die(new Error(`Expected one listener to terminate, found ${listeners.length}`));
				}
				yield* engine.sql`select pg_terminate_backend(${listener.pid})`;
				yield* Effect.promise(async () => {
					await recovered("first");
					await save("b", "after reconnect");
					await changedSinceMark("a", "another");
				});
			}),
		order: (name: Client) => Effect.promise(async () => (await client(engine, name).get()).name),
		rejectWrite: () =>
			Effect.promise(async () => {
				tell("the first server rejects a's transaction before commit; then b commits after rollback");
				mark();
				await process(engine, "first").send({ _tag: "Reject" }, "Rejected");
				await save("a", "rolled back");
				await save("b", "after rollback");
				await changedSinceMark("a", "b");
			}),
		saveFromServer: (writer: "a" | "b", name: string) =>
			Effect.promise(async () => {
				tell(`${writer} commits ${name} through its server`);
				mark();
				await save(writer, name);
				await changedSinceMark("a", "b");
			}),
		saveFromWorker: () =>
			Effect.promise(async () => {
				tell("the pg-boss worker commits the order as worker");
				mark();
				const worker = process(engine, "worker");
				const handled = worker.next("Handled");
				await worker.send({ _tag: "Enqueue", order: new Order({ id: 1, name: "worker", quantity: 500 }) }, "Enqueued");
				await handled;
				await changedSinceMark("a", "b");
			}),
		terminateBackends: () =>
			Effect.gen(function* () {
				tell("PostgreSQL terminates every other backend in the story database; once both servers recover, a commits after failover");
				mark();
				yield* engine.sql`select pg_terminate_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()`;
				yield* Effect.promise(async () => {
					await Promise.all([recovered("first"), recovered("second")]);
					await save("a", "after failover");
					await changedSinceMark("a", "b", "another");
				});
			}),
	};
}
