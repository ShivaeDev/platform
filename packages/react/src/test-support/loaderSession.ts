import { Data, Deferred, Effect } from "effect";

export class Unauthorized extends Data.TaggedError("Unauthorized") {}
export class Unavailable extends Data.TaggedError("Unavailable") {}
export interface LoaderSession {
	busy: () => boolean;
	readonly gate: Deferred.Deferred<string, Unauthorized | Unavailable>;
	readonly recheckedSessions: string[];
	rechecks: number;
	session: string | undefined;
}
export function loaderSession(): LoaderSession {
	return {
		busy: () => false,
		gate: Effect.runSync(Deferred.make<string, Unauthorized | Unavailable>()),
		recheckedSessions: [],
		rechecks: 0,
		session: "visitor",
	};
}
