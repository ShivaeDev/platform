import { Cause, Config, Effect, Exit, Layer } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { hostLayer, inboxState } from "#test/host.ts";
import { postgresLayer } from "#test/postgresLayer.ts";

function startupOutcome(exit: Exit.Exit<unknown, unknown>) {
	return Exit.isSuccess(exit)
		? ["started"]
		: exit.cause.reasons.map((reason) =>
				Cause.isFailReason(reason) && reason.error instanceof Config.ConfigError
					? `configuration failed: ConfigError: ${reason.error.message}`
					: `startup failed: ${Cause.pretty(Cause.fromReasons([reason]))}`,
			);
}

export const startup = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => inboxState(undefined),
	layer: postgresLayer,
	name: "webhook startup",
	stages: ["configuration"],
	verbs: (state, story) => ({
		buildHost: () => {
			story.tell("the application builds its host with the webhook route");
			return Layer.build(hostLayer(state)).pipe(Effect.scoped, Effect.exit, Effect.map(startupOutcome));
		},
	}),
});

export const signingKeyMissing = startup.trait("configuration", "no webhook signing key is configured", (state) => {
	state.signingKey = undefined;
});
