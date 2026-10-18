import { Layer, Option } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { createElement } from "react";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { useQuery } from "#client/resultState.ts";
import { PublicConfigDeclaration } from "./Declaration.ts";

function configQuery(url: string) {
	class Client extends AtomRpc.Service<Client>()("test/PublicConfigDeclarationClient", {
		group: PublicConfigDeclaration,
		protocol: RpcClient.layerProtocolHttp({ url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
	}) {}
	const config = bind(PublicConfigDeclaration, Client);
	return config.get.query();
}

function Install({ configuration }: { readonly configuration: ReturnType<typeof configQuery> }) {
	const query = useQuery(configuration);
	return createElement(
		"a",
		{ href: Option.map(query.data, (value) => value.installUrl.href).pipe(Option.getOrUndefined) },
		Option.isSome(query.data) ? "Install application" : "Loading configuration",
	);
}

export function configView(url: string) {
	return createElement(Install, { configuration: configQuery(url) });
}
