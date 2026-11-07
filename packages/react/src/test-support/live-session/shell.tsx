import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Socket from "effect/socket/Socket";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { Note } from "#test/live-session/App.tsx";
import { connect } from "#test/live-session/connect.ts";

export interface Connection {
	readonly id: string;
	readonly registry: AtomRegistry.AtomRegistry;
}

export function shell(url: string, view: Rendered, browser: boolean, runtime: Atom.RuntimeFactory) {
	const connections: Connection[] = [];
	return {
		connections,
		show: (session: { readonly id: string; readonly token: string } | undefined) =>
			view.render(
				<SessionBoundary
					connect={(current, registry) => {
						const api = browser
							? connect(url, registry, runtime, undefined, Socket.layerWebSocketConstructorGlobal)
							: connect(url, registry, runtime, current.token);
						connections.push({ id: current.id, registry });
						return api;
					}}
					identify={(current) => current.id}
					recheck={() => undefined}
					session={session}
					signedOut="Signed out"
				>
					{(api) => <Note client={api} />}
				</SessionBoundary>,
			),
	};
}
