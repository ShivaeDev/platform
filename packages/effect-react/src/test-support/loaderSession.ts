import { Data, Deferred, Effect } from "effect";

export class Unauthorized extends Data.TaggedError("Unauthorized") {}
export class Unavailable extends Data.TaggedError("Unavailable") {}
export interface LoaderSession {
	readonly gate: Deferred.Deferred<string, Unauthorized | Unavailable>;
	rechecks: number;
	session: string | undefined;
}
export function loaderSession(): LoaderSession {
	return {
		gate: Effect.runSync(Deferred.make<string, Unauthorized | Unavailable>()),
		rechecks: 0,
		session: "visitor",
	};
}
