import { Context, Effect, Layer, Option, Schema } from "effect";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { query } from "@shivaedev/contract/operation.ts";
import type { AppModule } from "#AppModule.ts";
import { appModules } from "#appModules.ts";

class Owners extends Context.Service<Owners, { readonly owns: (viewer: string, id: number) => Effect.Effect<boolean> }>()(
	"@shivaedev/server/compiler/Owners",
) {}

const Owned = defineModule({
	name: "owned",
	operations: [
		query("title", {
			payload: { id: Schema.Number },
			readPolicy: ({ id }, viewer) =>
				Option.match(viewer, {
					onNone: () => Effect.succeed(false),
					onSome: ({ id: viewerId }) => Effect.flatMap(Owners, (owners) => owners.owns(viewerId, id)),
				}),
			reads: () => [],
			*run({ id }) {
				return yield* Effect.succeed(`note ${id}`);
			},
		}),
	],
	wire: { title: { rejections: {}, success: Schema.String } },
});

const owned = { module: Owned, services: Layer.empty } satisfies AppModule;

appModules([owned]);
