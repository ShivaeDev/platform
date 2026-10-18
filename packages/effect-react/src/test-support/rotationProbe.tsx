import { act } from "react";
import { SessionBoundary } from "#session-boundary.ts";
import type { Rendered } from "#testing.ts";
export function rotationProbe(view: Rendered) {
	interface Rotating {
		readonly credential: number;
		readonly id: string;
		readonly token: string;
	}
	const connected: string[] = [];
	function show(session: Rotating, identify: (session: Rotating) => string) {
		return act(async () => {
			await view.render(
				<SessionBoundary
					connect={(current) => {
						connected.push(current.token);
						return current.token;
					}}
					identify={identify}
					recheck={() => undefined}
					session={session}
				>
					{(token) => <output>{token}</output>}
				</SessionBoundary>,
			);
			await Promise.resolve();
		});
	}

	return { connected, show };
}
