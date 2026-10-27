import type { Effect } from "effect";
import type { Form } from "@shivaedev/form/shape.ts";
import type { Create } from "#client/create.ts";
import type { DraftFields } from "./draftFields.ts";

export type Created = typeof DraftFields.Type;
export type CreateEffect = (values: Created) => Effect.Effect<Created, string>;
export interface CreateHeld {
	created?: Create<typeof DraftFields.fields, Created, string, never>;
	form?: Form<typeof DraftFields.fields, Created, string, never>;
}
export interface ProbeProps {
	readonly create: CreateEffect;
	readonly held: CreateHeld;
}
