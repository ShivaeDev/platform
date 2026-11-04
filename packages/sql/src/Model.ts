import { Schema } from "effect";

function Group<TFields extends Schema.Struct.Fields>(fields: TFields, options: { readonly prefix: string }) {
	return Schema.Struct(fields).annotate({ "@shivaedev/sql/groupPrefix": options.prefix });
}

export const Model = { Group };
