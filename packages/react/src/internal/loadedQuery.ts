import { type Cause, Option } from "effect";

interface QuerySnapshot<A, E> {
	readonly cause: Option.Option<Cause.Cause<E>>;
	readonly data: Option.Option<A>;
	readonly pending: boolean;
	readonly refresh: () => void;
}

export function loadedQuery<A, E>(query: QuerySnapshot<A, E>, loaded: A) {
	return {
		cause: query.cause,
		data: Option.getOrElse(query.data, () => loaded),
		pending: query.pending,
		refresh: query.refresh,
		refreshing: query.pending,
	};
}
