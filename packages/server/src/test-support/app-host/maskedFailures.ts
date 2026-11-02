import { Layer } from "effect";
import { appHost } from "#appHost.ts";
import { maskedFailureApi, maskedFailureHandlers } from "./maskedFailureApi.ts";
import { host } from "./story.ts";

export const maskedFailures = host.trait("configured", "the RPC declares structured sensitive failure fields", (state) => {
	state.build = () =>
		appHost({ config: state.config, group: maskedFailureApi, handlers: maskedFailureHandlers, policy: "loopback", services: Layer.empty });
});
