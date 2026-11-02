import { Effect, Schema, SchemaGetter } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { schemaSensitiveKeys } from "#schemaSensitiveKeys.ts";

const positive = Schema.Number.check(Schema.isGreaterThan(0));
const privateObject = Schema.Struct({ password: Schema.String }).check(Schema.makeFilter((value) => value.password.length === 4));
const Transformed = Schema.Struct({ privateAmount: positive.annotate({ sensitive: true }) }).pipe(
	Schema.encodeTo(Schema.Struct({ encoded: Schema.Number }), {
		decode: SchemaGetter.transform(({ encoded }) => ({ privateAmount: encoded })),
		encode: SchemaGetter.transform(({ privateAmount }) => ({ encoded: privateAmount })),
	}),
);
const schemas = {
	explicit: positive.annotate({ redactionMask: 1, sensitive: true }),
	explicitContainer: privateObject.annotate({ redactionMask: { password: "mask" } }),
	explicitTransform: Transformed.annotate({ redactionMask: { encoded: 1 } }),
	generic: Schema.String.check(Schema.isMinLength(1)).annotate({ sensitive: true }),
	invalid: positive.annotate({ redactionMask: 0, sensitive: true }),
	missing: positive.annotate({ sensitive: true }),
	missingContainer: privateObject,
	missingTransform: Transformed,
};

export const wireMasks = storyKit({
	create: () => ({}),
	name: "RPC wire mask definition",
	stages: [],
	verbs: (_state, story) => ({
		define: (shape: keyof typeof schemas) => {
			story.tell(`define an RPC with a ${shape} sensitive mask`);
			const group = RpcGroup.make(Rpc.make("Save", { error: Schema.Struct({ amount: schemas[shape] }), success: Schema.Void }));
			return schemaSensitiveKeys(group).pipe(
				Effect.map(() => "accepted" as const),
				Effect.catchTag("InvalidRedactionMask", (error) =>
					Effect.succeed({ field: error.field, message: error.message, refused: "invalid redaction mask" }),
				),
			);
		},
	}),
});
