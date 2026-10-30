import { Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { appHost } from "#appHost.ts";
import { host } from "./story.ts";

export function sensitiveFailureTag(source: "schema" | "host") {
	return host.trait("configured", `the ${source} marks error tags as sensitive`, (state) => {
		const Tag = source === "schema" ? Schema.String.annotate({ sensitive: true }) : Schema.String;
		const group = RpcGroup.make(
			Rpc.make("taggedFailure", {
				error: Schema.Struct({ _tag: Tag, detail: Schema.String, message: Tag }),
				payload: { _tag: Schema.String },
				success: Schema.Void,
			}),
			Rpc.make("publicConflict", { error: Conflict, success: Schema.Void }),
		);
		const handlers = group.toLayer({
			publicConflict: () => Effect.fail(new Conflict({ message: "Name is taken" })),
			taggedFailure: ({ _tag }) => Effect.fail({ _tag, detail: "public detail", message: "private message" }),
		});
		state.config.sensitiveKeys = source === "host" ? ["_tag"] : [];
		state.build = () => appHost({ config: state.config, group, handlers, policy: "loopback", services: Layer.empty });
	});
}
