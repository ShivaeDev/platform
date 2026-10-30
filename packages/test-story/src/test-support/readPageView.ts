import { RegistryContext, useAtomValue } from "@effect/atom-react";
import type { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { createElement, useContext, useState } from "react";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { browserReads } from "#browserReads.ts";
import { ReadPage } from "./readPageHost.ts";

export function makePageClient(url: string, protocol: EffectReads["protocol"]) {
	return makeClient(ReadPage, { protocol, url });
}
type EffectReads = Effect.Success<ReturnType<typeof browserReads>>;
type PageClient = ReturnType<typeof makePageClient>;

function PageTitle({ client, pageId }: { readonly client: PageClient; readonly pageId: number }) {
	const result = useAtomValue((pageId === 2 ? client.api.second : client.api.get).query({ id: pageId }));
	return createElement(
		"output",
		null,
		AsyncResult.getOrElse(result, () => "Loading"),
	);
}

export function ReadPageView({ client, fetch }: { readonly client: PageClient; readonly fetch: typeof globalThis.fetch }) {
	const registry = useContext(RegistryContext);
	const [extra, setExtra] = useState<number>();
	const [signedIn, setSignedIn] = useState(false);
	const [sessionPending, setSessionPending] = useState(false);
	useAtomValue(client.api[LiveConnection].connection);
	return createElement(
		"main",
		{ "aria-busy": sessionPending },
		createElement(PageTitle, { client, pageId: 1 }),
		extra === undefined ? null : createElement(PageTitle, { client, pageId: extra }),
		createElement("button", { onClick: () => setExtra(2), type: "button" }, "Open second page"),
		createElement("button", { onClick: () => setExtra(3), type: "button" }, "Open private page"),
		createElement(
			"button",
			{
				onClick: async () => {
					setSessionPending(true);
					const response = await fetch(signedIn ? "/sign-out" : "/sign-in", { method: "POST" });
					const session = await response.text();
					const identity = client.api[LiveConnection].identity;
					if (identity === undefined) {
						throw new Error("The page client has no session identity");
					}
					registry.set(identity, session || undefined);
					setSignedIn(!signedIn);
					setSessionPending(false);
				},
				type: "button",
			},
			signedIn ? "Sign out" : "Sign in",
		),
	);
}
