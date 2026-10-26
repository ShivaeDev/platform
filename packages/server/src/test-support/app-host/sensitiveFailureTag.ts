import { Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { appHost } from "#appHost.ts";
import { host } from "./story.ts";

export function sensitiveFailureTag(source: "schema" | "host") {
	return host.trait("configured", `the ${source} marks error tags as sensitive`, (state) => {
		const Tag = source === "schema" ? Schema.String.annotate({ sensitive: true }) : Schema.String;
		const group = RpcGroup.make(
			Rpc.make("taggedFailure", {
				error: Schema.Struct({ _tag: Tag, detail: Schema.String }),
				payload: { _tag: Schema.String },
				success: Schema.Void,
			}),
		);
		const handlers = group.toLayer({ taggedFailure: ({ _tag }) => Effect.fail({ _tag, detail: "public detail" }) });
		state.config.sensitiveKeys = source === "host" ? ["_tag"] : [];
		state.build = () => appHost({ config: state.config, group, handlers, policy: "loopback", services: Layer.empty });
	});
}
