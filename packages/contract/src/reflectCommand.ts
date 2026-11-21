import { Effect, Exit } from "effect";
import type { CommandState } from "#commandSignal.ts";
import { reflectionScope } from "#reflection.ts";
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
	return Effect.flatMap(reflectionScope(client), ({ piggyback, reflection }) => {
		const own = standalone ? reflection.flight() : reflection.send(piggyback);
		const finish = observer.pending();
		observer.signal("sent");
		const sent = own === undefined ? send() : send({ headers: commandSyncHeaders({ client: reflection.client, id: own }) });
		return Effect.onExit(sent, (exit) =>
			Effect.sync(() => {
				if (Exit.isFailure(exit)) {
					reflection.failed(own);
					finish();
					return;
				}
				observer.signal("accepted");
				reflection.accepted(own, () => {
					finish();
					observer.signal("reflected");
				});
			}),
		);
	});
}
