import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Socket from "effect/socket/Socket";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { Note } from "./App.tsx";
import { connect } from "./connect.ts";

export interface Connection {
	readonly id: string;
	readonly registry: AtomRegistry.AtomRegistry;
}

export function shell(url: string, view: Rendered, browser: boolean) {
	const connections: Connection[] = [];
	return {
		connections,
		show: (session: { readonly id: string; readonly token: string } | undefined) =>
			view.render(
				<SessionBoundary
					connect={(current, registry) => {
						const api = browser ? connect(url, registry, undefined, Socket.layerWebSocketConstructorGlobal) : connect(url, registry, current.token);
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
