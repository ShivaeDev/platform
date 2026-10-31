import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createElement, useContext, useState } from "react";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { ReadPage } from "./readPageHost.ts";

export function activityPageClient(url: string) {
	return makeClient(ReadPage, { url, webSocketConstructor: layerWebSocketConstructorWS });
}
type PageClient = ReturnType<typeof activityPageClient>;

export function ActivityPageView({ client }: { readonly client: PageClient }) {
	const registry = useContext(RegistryContext);
	const result = useAtomValue(client.api.get.query({ id: 1 }));
	const [title, setTitle] = useState("");
	return createElement(
		"main",
		null,
		createElement(
			"output",
			null,
			AsyncResult.getOrElse(result, () => "Loading"),
		),
		createElement("input", { onInput: (event) => setTitle(event.currentTarget.value), value: title }),
		createElement(
			"button",
			{
				onClick: () => Effect.runPromise(AtomRegistry.getResult(registry, client.runtime.atom(client.api.write.run({ id: 1, title })))),
				type: "button",
			},
			"Save",
		),
	);
}
