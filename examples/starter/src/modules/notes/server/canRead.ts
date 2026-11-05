import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { getNote } from "./get.ts";

export const canReadNote = Effect.fn("NotesService.canReadNote")((id: number) =>
	getNote(id).pipe(
		Effect.as(true),
		Effect.mapError((cause) =>
			cause._tag === "NotFound" || cause._tag === "ServiceUnavailable"
				? cause
				: Object.assign(new ServiceUnavailable({ message: "Could not check note access" }), { cause }),
		),
	),
);
