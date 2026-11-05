import { RegistryContext, useAtom, useAtomValue } from "@effect/atom-react";
import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createElement, useContext } from "react";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { ReadPage } from "./readPageHost.ts";

export function activityPageClient(url: string) {
	return makeClient(ReadPage, { url, webSocketConstructor: layerWebSocketConstructor });
}
const titleDraft = Atom.make("");

type PageClient = ReturnType<typeof activityPageClient>;

export function ActivityPageView({ client }: { readonly client: PageClient }) {
	const registry = useContext(RegistryContext);
	const result = useAtomValue(client.api.get.query({ id: 1 }));
	const [title, setTitle] = useAtom(titleDraft);
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
