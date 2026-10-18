import { Context, Deferred, Effect, Exit, Layer, Scope } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { exposeFailure } from "#exposeFailure.ts";
import { Fleet } from "#fleet.ts";
import { daemonHostOptions, daemonHttpLayer } from "#host/daemon.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { GithubApi } from "#host/githubApi.ts";
import { FleetContract } from "#operations.ts";
import { answerDelay } from "#test/answerDelay.ts";
import { hostFixture, task } from "#test/fleetHost.ts";
import { syntheticGithub } from "#test/githubApi.ts";

function continueReplies(after: Effect.Effect<void>) {
	return FleetContract.toLayerHandler(
		"fleet.continue",
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			return ({ workId, message }) =>
				exposeFailure(
					fleet.continue(workId, message).pipe(
						Effect.tap(after),
						Effect.map(({ value }) => value),
					),
				);
		}),
	);
}

export const controlPublicationHost = Effect.fn("ControlPublicationTest.controlPublicationHost")(function* () {
	const fixture = yield* hostFixture({ "one.md": task("one", "approved"), "two.md": task("two", "approved") });
	const archive = yield* answerDelay(fixture, "archive");
	const entered = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const lost = yield* Deferred.make<void>();
	const state = { block: false, dropNext: false };
	const github = Layer.effect(GithubApi)(
		Effect.map(GithubApi, (api) => ({
			...api,
			observations: () =>
				Effect.gen(function* () {
					if (state.block) {
						yield* Deferred.succeed(entered, undefined);
						yield* Deferred.await(release);
					}
					return yield* api.observations();
				}),
		})),
	).pipe(Layer.provide(fixture.parts.github ?? syntheticGithub().layer));
	const options = daemonHostOptions(fixture.host, { ...archive.parts, github }, 0);
	const intercepted = continueReplies(
		Effect.gen(function* () {
			if (state.dropNext) {
				state.dropNext = false;
				yield* Deferred.succeed(lost, undefined);
				yield* Effect.never;
			}
		}),
	).pipe(Layer.provideMerge(options.handlers));
	const daemonScope = yield* Scope.make();
	const close = Scope.close(daemonScope, Exit.void);
	yield* Effect.addFinalizer(() => close);
	const context = yield* Layer.buildWithScope(daemonHttpLayer({ ...options, handlers: intercepted }), daemonScope);
	yield* Effect.addFinalizer(() => Deferred.succeed(release, undefined).pipe(Effect.andThen(archive.release)));
	const address = Context.get(context, HttpServer.HttpServer).address;
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die("Expected a TCP daemon");
	}
	return { archive, client: yield* daemonClient(address.port), close, context, entered, fixture, lost, port: address.port, release, state };
});
