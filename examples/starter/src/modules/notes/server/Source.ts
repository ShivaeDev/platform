import { Context, type Effect } from "effect";
import type { NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";

export class NoteSource extends Context.Service<
	NoteSource,
	{
		readonly title: (id: number) => Effect.Effect<string, NotFound | ServiceUnavailable>;
	}
>()("app/NoteSource") {}
