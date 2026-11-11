import type { ResourceNames } from "#resource/names.ts";

export function resourceModel({ pascal, table }: ResourceNames) {
	return `import { Schema } from "effect";
import { Model } from "effect/schema";
import { collection } from "@shivaedev/changes/keys.ts";

export class Item extends Model.Class<Item>("${pascal}Item")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	title: Schema.Trim.check(Schema.isNonEmpty({ message: "Enter a title" })),
}) {}

export const Fields = Schema.Struct({ title: Item.fields.title });
export const keys = collection("${table}", Schema.Number, { userId: Schema.String });

export function toItem({ id, title }: typeof Item.json.Type): typeof Item.json.Type {
	return { id, title };
}
`;
}

export function resourceModule({ camel, name, pascal }: ResourceNames) {
	return `import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { ${camel}Wire } from "#generated/modules/${name}/${pascal}.ts";
import { Create } from "#modules/${name}/server/Create.ts";
import { List } from "#modules/${name}/server/List.ts";
import { ${pascal}Repository } from "#modules/${name}/server/Repository.ts";

export const ${pascal} = defineModule({
	middleware: AuthenticatedUser,
	name: "${name}",
	operations: [List, Create],
	requires: [${pascal}Repository],
	wire: ${camel}Wire,
});
`;
}
