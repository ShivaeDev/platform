import { Effect, Schema, SchemaGetter } from "effect";
import { defineQueue } from "#server/definition.ts";
import { ApplicationLog } from "./workers.ts";

export const CodecQueue = defineQueue({
	name: "caller-codec",
	schema: Schema.Struct({
		value: Schema.Number.pipe(
			Schema.decodeTo(Schema.Number, {
				decode: SchemaGetter.passthrough(),
				encode: SchemaGetter.checkEffect((value) =>
					Effect.map(ApplicationLog, (log) => {
						log(`encoded ${value}`);
						return true;
					}),
				),
			}),
		),
	}),
});
