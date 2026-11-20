// A stored credential whose digest never leaves the server, spelled with the native variants that serverOnly from
// @shivaedev/sql returns: the select variant decodes to Redacted and refuses every encode.
export const CREDENTIAL_MODEL = `import { Schema } from "effect";
import { Model } from "effect/schema";
import { collection } from "@shivaedev/changes/keys.ts";

export const credentials = collection("credentials", Schema.Number);

const digest = Model.Field({
	insert: Schema.RedactedFromValue(Schema.String),
	select: Schema.RedactedFromValue(Schema.String, { disallowEncode: true }),
	update: Schema.RedactedFromValue(Schema.String),
});

export class Credential extends Model.Class<Credential>("Credential")({ digest, id: Schema.Number, owner: Schema.String }) {}
`;
