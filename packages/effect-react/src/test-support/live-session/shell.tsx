import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { Rendered } from "#client/testing.ts";
import { Note } from "./App.tsx";
import { connect } from "./connect.ts";

export function shell(url: string, view: Rendered) {
	const connections: Array<{ readonly api: ReturnType<typeof connect>; readonly registry: AtomRegistry.AtomRegistry }> = [];
	return {
		connections,
		show: (session: { readonly id: string; readonly token: string } | undefined) =>
			view.render(
				<SessionBoundary
					connect={(current, registry) => {
						const api = connect(url, registry, current.token);
						connections.push({ api, registry });
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
		text: () => view.container.textContent,
	};
}
