import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { Editor } from "#test/order-example/Editor.tsx";
import { makeClient } from "#test/order-example/makeClient.ts";
import { countedHttp } from "./countedHttp.ts";
import { SessionRegistry } from "./SessionRegistry.tsx";

export interface Session {
	readonly id: string;
	readonly token: string;
}

export function shell(url: string, view: Rendered) {
	window.location.href = url;
	const http = countedHttp();
	const registries = new Map<string, AtomRegistry.AtomRegistry>();
	const rechecks: string[] = [];
	function show(session: Session | undefined, id: number) {
		return view.render(
			<SessionBoundary
				connect={(current) => makeClient({ httpClient: http.layer, token: current.token, url })}
				identify={(current) => current.id}
				recheck={() => rechecks.push(session?.id ?? "none")}
				session={session}
				signedOut={<p>Signed out</p>}
			>
				{(client) => (
					<>
						<SessionRegistry onRegistry={(registry) => registries.set(session?.id ?? "none", registry)} />
						<Editor client={client} id={id} />
					</>
				)}
			</SessionBoundary>,
		);
	}
	function pending() {
		const text = view.container.textContent ?? "";
		return http.inFlight() > 0 || text.includes("Loading order…") || text.includes("Saving…");
	}
	return { close: view.unmount, container: view.container, pending, rechecks, registries, show };
}

export function sessions() {
	return new Map([
		["alice-token", { expiresAt: Number.POSITIVE_INFINITY, userId: "alice" }],
		["bob-token", { expiresAt: Number.POSITIVE_INFINITY, userId: "bob" }],
	]);
}
