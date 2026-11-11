import { Effect, Layer, Option } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { Create, Get, List, Rename } from "#test/notes/operations.ts";
import { NotesRepository } from "#test/notes/repository.ts";

export class NotesViewer extends RpcMiddleware.Service<NotesViewer>()("@shivaedev/test-kits/test/NotesViewer", { error: Unauthorized }) {}

export const noteOperations = [List, Get, Create, Rename] as const;

export const Notes = defineModule({ middleware: NotesViewer, name: "notes", operations: noteOperations, requires: [NotesRepository] });

export const notesHandlers = moduleHandlers(Notes);

export function viewerFromHeader(fallback?: string) {
	return Layer.succeed(NotesViewer, (effect, { headers }) =>
		Effect.provideService(
			effect,
			CurrentViewer,
			Option.map(Option.fromUndefinedOr(headers.viewer ?? fallback), (id) => ({ id })),
		),
	);
}
