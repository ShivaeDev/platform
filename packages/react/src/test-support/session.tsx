import { Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { clientActivity, isClientSettled } from "@shivaedev/contract/clientActivity.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { Editor } from "#test/order-example/Editor.tsx";
import { makeClient } from "#test/order-example/makeClient.ts";
import { SessionRegistry } from "#test/SessionRegistry.tsx";

export interface Session {
	readonly id: string;
	readonly token: string;
}

export function shell(url: string, view: Rendered) {
	window.location.href = url;
	let connected: ReturnType<typeof makeClient> | undefined;
	const registries = new Map<string, AtomRegistry.AtomRegistry>();
	const rechecks: string[] = [];
	function show(session: Session | undefined, id: number) {
		return view.render(
			<SessionBoundary
				connect={(signedIn) => {
					connected = makeClient({ token: signedIn.token, url });
					return connected;
				}}
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
		const working = connected !== undefined && !isClientSettled(Effect.runSync(clientActivity(connected.connection).current));
		return working || text.includes("Loading order…") || text.includes("Saving…");
	}
	return { close: view.unmount, container: view.container, pending, rechecks, registries, show };
}

export function sessions() {
	return new Map([
		["alice-token", { user: { id: "alice" } }],
		["bob-token", { user: { id: "bob" } }],
	]);
}
