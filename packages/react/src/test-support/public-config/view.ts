import { Option } from "effect";
import { createElement } from "react";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { useQuery } from "#client/resultState.ts";
import { PublicConfigDeclaration } from "./Declaration.ts";

function configQuery(url: string) {
	const { api } = makeRpcClient(PublicConfigDeclaration, { url });
	const config = api;
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
