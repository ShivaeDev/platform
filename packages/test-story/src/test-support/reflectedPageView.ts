import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createElement, useContext, useState } from "react";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { ReflectedPage } from "#test/reflectedPageHost.ts";

export function reflectedPageClient(url: string) {
	return makeClient(ReflectedPage, { url, webSocketConstructor: layerWebSocketConstructor });
}

type PageClient = ReturnType<typeof reflectedPageClient>;

export function ReflectedPageView({ client }: { readonly client: PageClient }) {
	const registry = useContext(RegistryContext);
	const result = useAtomValue(client.api.title.query());
	const [title, setTitle] = useState("");
	function run(name: "touch" | "write") {
		void Effect.runPromise(
			AtomRegistry.getResult(registry, client.runtime.atom(name === "touch" ? client.api.touch.run() : client.api.write.run({ title }))),
		);
	}
	return createElement(
		"main",
		null,
		createElement(
			"output",
			null,
			AsyncResult.getOrElse(result, () => "Loading"),
		),
		createElement("input", { onInput: (event) => setTitle(event.currentTarget.value), value: title }),
		createElement("button", { onClick: () => run("write"), type: "button" }, "Save"),
		createElement("button", { onClick: () => run("touch"), type: "button" }, "Touch"),
	);
}
