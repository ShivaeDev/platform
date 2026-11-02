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
};

export const fieldScope = storyKit({
	create: () => ({}),
	name: "RPC field scope registration",
	stages: [],
	verbs: (_state, story) => ({
		register: (shape: keyof typeof schemas) => {
			story.tell(`register an RPC with ${shape} field names`);
			const declaration: { error: Schema.Top; success: Schema.Top } = schemas[shape];
			return schemaSensitiveKeys(RpcGroup.make(Rpc.make("Read", declaration))).pipe(
				Effect.match({
					onFailure: ({ field, publicSchema, sensitiveSchema }) => ({ field, publicSchema, sensitiveSchema }),
					onSuccess: () => "accepted" as const,
				}),
			);
		},
	}),
});
