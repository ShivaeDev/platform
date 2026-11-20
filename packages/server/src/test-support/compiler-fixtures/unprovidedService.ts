import { Context, type Effect, Layer, Schema } from "effect";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command } from "@shivaedev/contract/operation.ts";
import type { AppModule } from "#AppModule.ts";
import { appModules } from "#appModules.ts";

class NoteSource extends Context.Service<NoteSource, { readonly title: (id: number) => Effect.Effect<string> }>()(
	"@shivaedev/server/compiler/NoteSource",
) {}

const Imports = defineModule({
	name: "imports",
	operations: [
		command("importTitle", {
			payload: { id: Schema.Number },
			*run({ id }) {
				return yield* (yield* NoteSource).title(id);
			},
		}),
	],
	wire: { importTitle: { rejections: {}, success: Schema.String } },
});

const imports = { module: Imports, services: Layer.empty } satisfies AppModule;

appModules([imports]);
