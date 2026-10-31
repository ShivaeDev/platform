import { Effect } from "effect";
import { answerWord, hintWord } from "./hintWords.ts";
import { privateClient } from "./privateClient.ts";
import { type ProcessEngine, process } from "./processEngine.ts";
import { startProcess } from "./startProcess.ts";

type PrivateClient = "writer" | "reader" | "bob";

function privateClientOf(engine: ProcessEngine, name: string) {
	const found = engine.privateClients.get(name);
	if (!found) {
		throw new Error(`Missing private client ${name}`);
	}
	return found;
}

function since(engine: ProcessEngine, name: PrivateClient) {
	return privateClientOf(engine, name).delivered.items.slice(engine.marks.get(name) ?? 0);
}

function deliveredSinceMark(engine: ProcessEngine, ...names: readonly PrivateClient[]) {
	return Promise.all(names.map((name) => privateClientOf(engine, name).delivered.when(() => since(engine, name).length > 0)));
}

export const openPrivateCluster = Effect.fn("PrivateSessions.openPrivateCluster")(function* (engine: ProcessEngine) {
	for (const name of ["first", "second"]) {
		const host = yield* Effect.acquireRelease(
			Effect.promise(() => startProcess({ ...engine.configuration, applicationName: `${engine.configuration.applicationName}_${name}` })),
			(value) => Effect.promise(value.close),
		);
		engine.servers.set(name, host);
	}
	for (const [name, host, account] of [
		["writer", "first", "alice"],
		["reader", "second", "alice"],
		["bob", "second", "bob"],
	] as const) {
		const client = yield* Effect.acquireRelease(
			Effect.promise(() => privateClient(process(engine, host).url, account)),
			(value) => Effect.promise(value.close),
		);
		engine.privateClients.set(name, client);
	}
	yield* Effect.promise(() => Promise.all([...engine.privateClients.values()].map((client) => client.delivered.when((items) => items.length > 0))));
	for (const [name, client] of engine.privateClients) {
		engine.marks.set(name, client.delivered.items.length);
	}
});

export const holdPrivateSave = Effect.fn("PrivateSessions.holdPrivateSave")(function* (engine: ProcessEngine, title: string) {
	const host = process(engine, "first");
	yield* Effect.promise(() => host.send({ _tag: "Hold" }, "Held"));
	const entered = host.next("Entered");
	engine.privateSaving.pending = privateClientOf(engine, "writer").save(title);
	yield* Effect.promise(() => entered);
});

export function privateVerbs(engine: ProcessEngine, tell: (line: string) => void) {
	async function save(name: PrivateClient, title: string) {
		engine.answers.push(answerWord(await privateClientOf(engine, name).save(title)));
	}
	return {
		bobSaves: (title: string) =>
			Effect.promise(async () => {
				tell(`Bob saves his own title ${title}`);
				await save("bob", title);
				await deliveredSinceMark(engine, "bob");
			}),
		privateDeliveries: (name: PrivateClient) =>
			Effect.sync(() => since(engine, name).map(({ hint, list, title }) => `${hintWord(hint).split(" ")[0]}: ${title} / ${list.join(", ")}`)),
		privateRead: (name: PrivateClient) => Effect.promise(() => privateClientOf(engine, name).read()),
		privateSaves: () => Effect.sync(() => [...engine.answers]),
		rejectedPrivateSave: (title: string) =>
			Effect.promise(async () => {
				tell(`the first host rejects Alice's save of ${title}; then she saves After rollback`);
				await process(engine, "first").send({ _tag: "Reject" }, "Rejected");
				await save("writer", title);
				await save("writer", "After rollback");
				await deliveredSinceMark(engine, "writer", "reader");
			}),
		releasePrivateCommit: () =>
			Effect.promise(async () => {
				tell("the first host commits Alice's held save");
				process(engine, "first").child.send({ _tag: "Release" });
				const pending = engine.privateSaving.pending;
				if (!pending) {
					throw new Error("No private save is pending");
				}
				engine.answers.push(answerWord(await pending));
				await deliveredSinceMark(engine, "writer", "reader");
			}),
	};
}
