import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { getNote } from "./get.ts";
import type { NotesRepository } from "./makeRepository.ts";

export function canReadNote(repository: NotesRepository) {
	const get = getNote(repository);
	return Effect.fn("NotesService.canRead")((id: number, userId: string) =>
		get(id, userId).pipe(
			Effect.as(true),
			Effect.mapError((cause) =>
				cause._tag === "NotFound" || cause._tag === "ServiceUnavailable"
					? cause
					: Object.assign(new ServiceUnavailable({ message: "Could not check note access" }), { cause }),
			),
		),
	);
}
