import { Effect, Layer } from "effect";
import { appHost } from "#appHost.ts";
import { publicFailureRpc } from "./publicFailureRpc.ts";
import { host } from "./story.ts";

const handlers = publicFailureRpc.toLayer({ publicFailure: (payload) => Effect.fail(payload) });

export const publicFailures = host.trait("configured", "RPC failures contain public application data", (state) => {
	state.build = () => appHost({ config: state.config, group: publicFailureRpc, handlers, policy: "loopback", services: Layer.empty });
});
