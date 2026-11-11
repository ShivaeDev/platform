import { Effect } from "effect";
import { Order } from "#test/postgres-example/contract.ts";
import { answerWord } from "#test/postgres-example/hintWords.ts";
import { client, type ProcessEngine, process } from "#test/postgres-example/processEngine.ts";

type Client = "a" | "b" | "another";

export function processVerbs(engine: ProcessEngine, tell: (line: string) => void) {
	function mark() {
		for (const [name, remote] of engine.clients) {
			engine.marks.set(name, remote.results.items.length);
		}
	}
	function since(name: Client) {
		return client(engine, name).results.items.slice(engine.marks.get(name) ?? 0);
	}
	function changedSinceMark(...names: readonly Client[]) {
		return Promise.all(names.map((name) => client(engine, name).results.when(() => since(name).length > 0)));
	}
	async function save(writer: Client, name: string) {
		engine.answers.push(answerWord(await client(engine, writer).save(name)));
	}
	return {
		answers: () => Effect.sync(() => [...engine.answers]),
		hintsSinceAction: (name: Client) => Effect.sync(() => since(name).map((result) => `result ${result.name}`)),
		initialHints: (name: Client) => Effect.sync(() => client(engine, name).results.items.map((result) => `result ${result.name}`)),
		order: (name: Client) =>
			Effect.sync(() => {
				const result = client(engine, name).results.items.at(-1);
				if (result === undefined) {
					throw new Error("No pushed order");
				}
				return result.name;
			}),
		rejectWrite: () =>
			Effect.promise(async () => {
				tell("the first server rejects a's transaction before commit");
				mark();
				await process(engine, "first").send({ _tag: "Reject" }, "Rejected");
				await save("a", "rolled back");
			}),
		saveFromServer: (writer: "a" | "b", name: string) =>
			Effect.promise(async () => {
				tell(`${writer} commits ${name} through its server`);
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
	};
}
