import { Cause, Option, Predicate } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useEffect, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import type { ProjectionRoute } from "./projectionRoute.ts";
import type { RemainingRoute } from "./remainingRoute.ts";

type Route = ProjectionRoute | RemainingRoute;
export function useProjectionData<A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>, route: Route, url: string) {
	const query = useQuery(atom);
	const fresh = Option.getOrUndefined(query.data);
	const [retained, setRetained] = useState<{ readonly data: A; readonly route: Route; readonly url: string }>();
	useEffect(() => {
		if (fresh !== undefined) {
			setRetained({ data: fresh, route, url });
		}
	}, [fresh, route, url]);
	const failure = Option.getOrUndefined(Option.flatMap(query.cause, Cause.findErrorOption));
	const missing = Predicate.isTagged(failure, "NotFound");
	const conflict = Predicate.isTagged(failure, "Conflict");
	const terminal = missing || conflict;
	const data = terminal ? undefined : (fresh ?? (retained?.url === url ? retained.data : undefined));
	const content = terminal ? undefined : (data ?? (retained?.route === route ? retained.data : undefined));
	return { conflict, content, data, failure, missing, query };
}
