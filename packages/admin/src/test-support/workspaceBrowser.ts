import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { WorkspacePages } from "#test/workspaces.ts";

// Browser code: it merges the pages' contracts and imports nothing from the server registration.
export const workspaceBrowser = RpcGroup.make().merge(...WorkspacePages.pages.map((page) => page.contract));

export function workspaceBrowserClient(url: string, authorization: string | undefined) {
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: HttpClient.mapRequest((request) =>
			authorization === undefined ? request : HttpClientRequest.setHeader(request, "authorization", authorization),
		),
		url: `${url}/rpc`,
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	return RpcClient.make(workspaceBrowser, { flatten: true }).pipe(Effect.provide(protocol));
}
