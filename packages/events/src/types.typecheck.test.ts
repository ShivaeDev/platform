import { Context, Effect } from "effect";
import type { Projection } from "#types.ts";

class Mail extends Context.Service<Mail, { readonly send: Effect.Effect<void> }>()("@shivaedev/events/test/Mail") {}

const mail = Effect.flatMap(Mail, (service) => service.send);

const projection: Projection<string, never> = {
	// @ts-expect-error Projections cannot require external services that a rebuild would invoke.
	apply: () => mail,
	name: "mail",
	// @ts-expect-error Reset has the same database-only requirements as event application.
	reset: mail,
};

void projection;
