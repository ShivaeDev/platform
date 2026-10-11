import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect, Layer } from "effect";
import { FleetRepository, postgresFleetRepository } from "#engine/repository.ts";
import { recordThreadNames } from "#engine/threadNames.ts";
import { type FleetHost, HostFailure } from "#host/config.ts";
import { hostProvider } from "#host/providers.ts";
import { hostSql } from "#host/runtime.ts";
import { SessionTransport } from "#session/service.ts";

const nameThread = Effect.fn("FleetHost.nameThread")(function* (
	transport: typeof SessionTransport.Service,
	sessionId: string,
	name: string,
	desired: string,
) {
	if (transport.nameSession === undefined || transport.readSessionName === undefined) {
		return yield* new HostFailure({ message: "The Cloud provider does not support thread names" });
	}
	if ((yield* transport.readSessionName(sessionId)) === desired) {
		return false;
	}
	yield* transport.nameSession(sessionId, name);
	return true;
});

function reportRename(workId: string, sessionId: string, desired: string, rename: Effect.Effect<boolean, { readonly message: string }>) {
	return rename.pipe(
		Effect.flatMap((changed) => (changed ? Console.log(`${workId} ${sessionId}: renamed to ${desired}`) : Effect.void)),
		Effect.catch((error) => Console.error(`${workId} ${sessionId}: naming failed: ${error.message}`)),
	);
}

export function nameThreads(host: FleetHost) {
	if (host.provider !== "cloud") {
		return Effect.fail(new HostFailure({ message: "name-threads requires a Cloud provider" }));
	}
	const repository = postgresFleetRepository(host.namespace).pipe(Layer.provide(hostSql(host)));
	return Effect.gen(function* () {
		const transport = yield* SessionTransport;
		const records = yield* (yield* FleetRepository).list();
		const seen = new Set<string>();
		for (const { value } of records) {
			for (const [sessionId, name] of recordThreadNames(value)) {
				if (seen.has(sessionId)) {
					continue;
				}
				seen.add(sessionId);
				const desired = `${host.cloud?.threadNamePrefix ?? "Fleet: "}${name}`;
				yield* reportRename(value.workId, sessionId, desired, nameThread(transport, sessionId, name, desired));
			}
		}
	}).pipe(Effect.provide(Layer.mergeAll(repository, hostProvider(host), NodeServices.layer)));
}
