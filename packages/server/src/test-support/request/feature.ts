import { Context, Deferred, Effect, Layer, Option, Ref, Schema } from "effect";
import { Migrator } from "effect/sql";
import { contract } from "@shivaedev/contract/contract.ts";
import { HostVersion } from "@shivaedev/contract/HostVersion.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { selfSubject } from "@shivaedev/identity/subject.ts";
import type { AppModule } from "#AppModule.ts";
import { appHost } from "#appHost.ts";
import { appModules } from "#appModules.ts";
import { Shared } from "#test/request/Shared.ts";
import { requestViewService } from "#test/request/view/service.ts";

const Value = Schema.Struct({ build: Schema.Number, caller: Schema.String, computation: Schema.Number });
const Readout = Schema.Struct({ cached: Value, caller: Schema.String, captured: Schema.String, identity: Schema.String, subject: Schema.String });
const Feature = contract("request", {
	queries: [
		query("read", {
			payload: { concurrent: Schema.Boolean },
			readPolicy: () => requestViewService.use((view) => view.read()).pipe(Effect.map(({ caller }) => caller.length > 0)),
			reads: () => [],
			success: Schema.Array(Readout),
		}),
	],
	subject: selfSubject,
});
export const Api = Feature.merge(HostVersion.application);
class Gate extends Context.Service<Gate, Effect.Effect<void>>()("@shivaedev/server/test/request/Gate") {}

export const openHost = Effect.fnUntraced(function* (build: () => number) {
	const arrived = yield* Ref.make(0);
	const ready = yield* Deferred.make<void>();
	const gate = Ref.updateAndGet(arrived, (value) => value + 1).pipe(
		Effect.flatMap((count) => (count === 2 ? Deferred.succeed(ready, undefined) : Deferred.await(ready))),
		Effect.asVoid,
	);
	const module = {
		group: Feature,
		handlers: Feature.application.toLayer({
			"request.read": ({ concurrent }) =>
				Effect.gen(function* () {
					const view = yield* requestViewService;
					const first = yield* view.read();
					if (concurrent) {
						yield* yield* Gate;
					}
					return [first, yield* view.read()];
				}),
		}),
		migrations: { loader: Migrator.fromRecord({}) },
		name: "request",
		requestServices: requestViewService.layer,
		services: Layer.effect(
			Shared,
			Effect.gen(function* () {
				return { build: build(), computations: yield* Ref.make(0) };
			}),
		).pipe(Layer.merge(Layer.succeed(Gate, gate))),
	} satisfies AppModule;
	const modules = yield* appModules([module]);
	return appHost({
		...modules,
		config: { buildVersion: "story-version", disablePreemptiveShutdown: true, port: 0 },
		migrations: undefined,
		sessions: Layer.succeed(SessionPolicy, {
			origin: () => true,
			provider: {
				get: (headers) =>
					Effect.succeed(
						headers.authorization
							? Option.some({ user: { email: `${headers.authorization}@test.example`, id: headers.authorization, name: headers.authorization } })
							: Option.none(),
					),
			},
		}),
	});
});
