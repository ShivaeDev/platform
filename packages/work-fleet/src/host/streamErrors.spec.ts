import { expect } from "@effect/vitest";
import { Effect, Stream } from "effect";
import { RpcGroup, RpcTest } from "effect/rpc";
import { it } from "@shivaedev/effect-test/it.ts";
import { BadRequest, Conflict, Forbidden, NotFound, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { FleetError } from "#errors.ts";
import { daemonError } from "./daemonClient.ts";
import { Follow } from "./daemonContract.ts";

it.effect("daemon subscriptions declare the same platform errors as commands", function* () {
	const group = RpcGroup.make(Follow);
	let error: FleetError = new NotFound({ message: "Unknown work" });
	const handlers = group.toLayer({ "daemon.follow": () => Stream.fail(error) });
	const client = yield* RpcTest.makeClient(group, { flatten: true }).pipe(Effect.provide(handlers));
	for (const rejection of [
		new BadRequest({ message: "Invalid subscription" }),
		new Conflict({ message: "Subscription changed" }),
		new Forbidden({ message: "Subscription denied" }),
		new NotFound({ message: "Unknown work" }),
		new ServiceUnavailable({ message: "Snapshot unavailable" }),
	]) {
		error = rejection;
		const failure = yield* client("daemon.follow", { workIds: ["one"] }).pipe(Stream.runCollect, Effect.flip);
		expect(daemonError(failure, 12_345)).toMatchObject({ _tag: rejection._tag, message: rejection.message });
	}
});
