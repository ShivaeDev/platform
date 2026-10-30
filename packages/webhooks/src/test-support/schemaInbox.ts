import { Cause, Deferred, Effect, Exit, Fiber, Layer } from "effect";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { hostLayer, inboxState, startHost } from "#test/host.ts";
import { postgresLayer } from "#test/postgresLayer.ts";
import { webhookReceipts } from "#webhookReceipts.ts";

function startup(exit: Exit.Exit<unknown, unknown>) {
	if (Exit.isSuccess(exit)) {
		return "started";
	}
	const [error] = Cause.prettyErrors(exit.cause);
	return `refused to start: ${error?.message ?? Cause.pretty(exit.cause)}`;
}

export const schemaInbox = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => inboxState("check"),
	layer: postgresLayer,
	name: "webhook receipt migrations",
	stages: ["database", "host"],
	verbs: (state, story) => ({
		applyReceipts: () => {
			story.tell("the deployment applies the webhook receipts component");
			return webhookReceipts.apply;
		},
		host: () =>
			Effect.gen(function* () {
				if (state.url !== "") {
					return "started";
				}
				return (yield* Deferred.isDone(state.waiting)) ? `waiting for ${(yield* Deferred.await(state.waiting)).join(", ")}` : "not started";
			}),
		hostStart: () =>
			Effect.gen(function* () {
				if (state.host === undefined) {
					return yield* Effect.die(new Error("Declare hostWaitsForMigrations before reading its start"));
				}
				return startup(yield* Fiber.await(state.host));
			}),
		pending: () => Effect.map(webhookReceipts.pending, (pending) => pending ?? "nothing pending"),
		startInCheckMode: () => {
			story.tell("the host starts in check mode");
			return Layer.build(hostLayer(state)).pipe(Effect.scoped, Effect.exit, Effect.map(startup));
		},
	}),
});

export const jobsSchemaInstalled = schemaInbox.trait(
	"database",
	"the pg-boss schema is installed, so only the receipts component can be pending",
	() => pgBossSchema().apply,
);

export const hostWaitsForMigrations = schemaInbox.trait("host", "a host in wait mode is waiting for database migrations", function* (state) {
	state.mode = "wait";
	state.host = yield* startHost(state).pipe(Effect.forkScoped);
	yield* Deferred.await(state.waiting);
});
