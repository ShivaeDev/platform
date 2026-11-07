import type { ResourceNames } from "#resource/names.ts";

export function resourceContract({ name, pascal, table }: ResourceNames) {
	return `import { Option, Schema } from "effect";
import { Model } from "effect/schema";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { signedIn } from "@shivaedev/contract/readPolicy.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";
import { InternalServerError, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";

export class Item extends Model.Class<Item>("${pascal}Item")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	title: Schema.Trim.check(Schema.isNonEmpty({ message: "Enter a title" })),
}) {}

export const Fields = Schema.Struct({ title: Item.fields.title });
export const keys = collection("${table}", Schema.Number, { userId: Schema.String });

export const List = query("list", {
	readPolicy: signedIn,
	reads: (_input, viewer) => (Option.isSome(viewer) ? [keys.bucket.userId(viewer.value.id)] : []),
	rejections: { InternalServerError, ServiceUnavailable },
	success: Schema.Array(Item.json),
});

export const Create = command("create", {
	invalidates: () => [],
	payload: Fields,
	rejections: { InternalServerError, Invalid: fieldRejection(Fields), ServiceUnavailable },
	success: Item.json,
});

export const ${pascal}Contract = contract("${name}", { commands: [Create], queries: [List] }).middleware(AuthenticatedUser);
`;
}
