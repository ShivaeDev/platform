import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createClientEngine, selectClient } from "./engine.ts";
import { lifecycleVerbs } from "./lifecycleVerbs.ts";
import { clientVerbs } from "./verbs.ts";

export const httpClient = storyKit({
	create: createClientEngine,
	inspect: ({ otherOrigin, remote, lifecycle }) => ({
		clients: lifecycle.clients,
		otherOriginRequests: otherOrigin.requests.map(({ path }) => path),
		requests: remote.requests.map(({ path }) => path),
	}),
	layer: Layer.succeed(FetchHttpClient.RequestInit)({ redirect: "error" }),
	name: "outbound HTTP client",
	stages: ["transport", "routes"],
	verbs: (engine, story) => {
		engine.remote.narrate(story.tell);
		return { ...clientVerbs(engine, story), ...lifecycleVerbs(engine, story) };
	},
});

export function usingClient(transport: "fetch" | "node") {
	return httpClient.trait("transport", `requests use the ${transport} HTTP client`, (engine) => selectClient(engine.selection, transport));
}
