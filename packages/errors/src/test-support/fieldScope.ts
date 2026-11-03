import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { schemaSensitiveKeys } from "#schemaSensitiveKeys.ts";

const PrivateState = Schema.Struct({ state: Schema.String.annotate({ sensitive: true }) });
const PublicState = Schema.Struct({ status: Schema.String });
const EncodedPublicState = PublicState.pipe(Schema.encodeKeys({ status: "state" }));
const schemas = {
	bothEncoded: {
		error: PublicState.pipe(Schema.encodeKeys({ status: "wireState" })),
		success: PrivateState.pipe(Schema.encodeKeys({ state: "wireState" })),
	},
	bothSensitive: { error: PrivateState.pipe(Schema.encodeKeys({ state: "wireState" })), success: PrivateState },
	distinct: { error: PublicState.pipe(Schema.encodeKeys({ status: "wireStatus" })), success: PrivateState },
	nestedEncoded: { error: Schema.Struct({ details: EncodedPublicState }), success: PrivateState },
	publicEncoded: { error: EncodedPublicState, success: PrivateState },
	publicOnly: { error: EncodedPublicState, success: PublicState },
	threeConflicts: {
		error: Schema.Struct({ details: Schema.Struct({ category: Schema.String, location: Schema.String }), state: Schema.String }),
		success: Schema.Struct({
			category: Schema.String.annotate({ sensitive: true }),
			location: Schema.String.annotate({ sensitive: true }),
			state: Schema.String.annotate({ sensitive: true }),
			summary: PrivateState,
		}),
	},
};

export const fieldScope = storyKit({
	create: () => ({}),
	name: "RPC field scope registration",
	stages: [],
	verbs: (_state, story) => ({
		register: (shape: keyof typeof schemas | "multipleRpcs", extra: readonly string[] = []) => {
			story.tell(`register an RPC with ${shape} field names`);
			const declaration: { error: Schema.Top; success: Schema.Top } = schemas[shape === "multipleRpcs" ? "threeConflicts" : shape];
			const registration =
				shape === "multipleRpcs"
					? schemaSensitiveKeys(RpcGroup.make(Rpc.make("Read", declaration), Rpc.make("Other", schemas.bothEncoded)), extra)
					: schemaSensitiveKeys(RpcGroup.make(Rpc.make("Read", declaration)), extra);
			return registration.pipe(
				Effect.match({
					onFailure: (error) => (error._tag === "SensitiveFieldConflict" ? { conflicts: error.conflicts, message: error.message } : error),
					onSuccess: () => "accepted" as const,
				}),
			);
		},
	}),
});
