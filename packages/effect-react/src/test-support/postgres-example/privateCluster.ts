import { Effect } from "effect";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { privateClient } from "./privateClient.ts";
import { type ProcessEngine, process } from "./processEngine.ts";
import { startProcess, until } from "./processHarness.ts";

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
	yield* Effect.promise(() => until(() => [...engine.privateClients.values()].every((client) => client.delivered.length > 0)));
});
export function privateVerbs(engine: ProcessEngine, tell: (line: string) => void) {
	function client(name: string) {
		const found = engine.privateClients.get(name);
		if (!found) {
			throw new Error(`Missing private client ${name}`);
		}
		return found;
	}
	return {
		beginPrivateSave: (title: string) =>
			Effect.sync(() => {
				tell(`Alice submits ${title}`);
				engine.privateSaving.pending = client("writer").save(title);
			}),
		holdPrivateCommit: () =>
			Effect.gen(function* () {
				tell("the first host holds its next transaction before commit");
				const host = process(engine, "first");
				host.child.send({ _tag: "Hold" });
				yield* Effect.promise(() => host.wait("Held"));
			}),
		observePrivate: (check: () => void) => eventually(Effect.try({ catch: (error) => error, try: check })),
		privateCommitEntered: () => Effect.promise(() => process(engine, "first").wait("Entered")),
		privateDeliveries: (name: string) => [...client(name).delivered],
		privateRead: (name: string) => Effect.promise(() => client(name).read()),
		privateSave: (title: string) => {
			tell(`Alice saves ${title} on the first host`);
			return Effect.promise(() => client("writer").save(title));
		},
		privateSaveResult: () =>
			Effect.promise(async () => {
				if (!engine.privateSaving.pending) {
					throw new Error("No private save is pending");
				}
				return await engine.privateSaving.pending;
			}),
		rejectNextPrivateCommit: () =>
			Effect.gen(function* () {
				tell("the first host will reject its next transaction");
				const host = process(engine, "first");
				host.child.send({ _tag: "Reject" });
				yield* Effect.promise(() => host.wait("Rejected"));
			}),
		releasePrivateCommit: () => Effect.sync(() => process(engine, "first").child.send({ _tag: "Release" })),
		settlePrivate: () => Effect.sleep("300 millis"),
	};
}
