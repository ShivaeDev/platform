import { Effect, Exit } from "effect";
import type { CommandState } from "#commandSignal.ts";
import { reflections } from "#reflection.ts";
import { commandSyncHeaders } from "#syncHeader.ts";

export interface CommandObserver {
	readonly pending: () => () => void;
	readonly signal: (state: CommandState) => void;
}

export function reflectCommand<A, E, R>(
	client: object,
	observer: CommandObserver,
	send: (options?: { readonly headers: Record<string, string> }) => Effect.Effect<A, E, R>,
	standalone = false,
): Effect.Effect<A, E, R> {
	return Effect.suspend(() => {
		const scope = reflections.get(client);
		const reflection = scope?.reflection;
		let own: number | undefined;
		if (scope !== undefined) {
			own = standalone ? scope.reflection.flight() : scope.reflection.send(scope.piggyback);
		}
		const finish = observer.pending();
		observer.signal("sent");
		const sent =
			reflection === undefined || own === undefined ? send() : send({ headers: commandSyncHeaders({ client: reflection.client, id: own }) });
		return Effect.onExit(sent, (exit) =>
			Effect.sync(() => {
				if (Exit.isFailure(exit)) {
					reflection?.failed(own);
					finish();
					return;
				}
				observer.signal("accepted");
				function reflected() {
					finish();
					observer.signal("reflected");
				}
				if (reflection === undefined) {
					reflected();
				} else {
					reflection.accepted(own, reflected);
				}
			}),
		);
	});
}
