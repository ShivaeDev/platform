import { Context, Effect, Layer, Option } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { type DelegationRule, Subject } from "@shivaedev/identity/subject.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { coaching, Journal, type NotYourClient } from "#test/bound-subject/Journal.ts";

const Coaching = Context.Service<typeof coaching.service, DelegationRule<NotYourClient>>(coaching.service);

// The coach is signed in by a bearer token; who may act for whom is identity's job and is proven there.
const sessions = SessionPolicy.of({
	origin: () => true,
	provider: {
		get: (headers) =>
			Effect.succeed(
				Option.map(Option.fromUndefinedOr(headers.authorization?.replace(/^Bearer /u, "")), (id) => ({
					user: { email: `${id}@example.test`, emailVerified: true, id, name: id },
				})),
			),
	},
});

export const openHost = Effect.gen(function* () {
	const journals = new Map<string, readonly string[]>();
	const reactivity = yield* Reactivity.make;
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Journal,
			handlers: Journal.application.toLayer({
				"journal.entries": () => Effect.map(Subject, ({ id }) => `${id}: ${(journals.get(id) ?? []).join(", ")}`),
				"journal.write": ({ entry }) =>
					Effect.flatMap(Subject, ({ id }) =>
						Effect.sync(() => {
							journals.set(id, [...(journals.get(id) ?? []), entry]);
						}),
					),
			}),
			services: Layer.merge(liveServerLayer, Layer.succeed(Coaching, { allows: () => Effect.succeed(true) })).pipe(
				Layer.provideMerge(Layer.succeed(Reactivity.Reactivity, reactivity)),
			),
			sessions: Layer.succeed(SessionPolicy, sessions),
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	return { url: `http://127.0.0.1:${server.address.port}/rpc` };
});
