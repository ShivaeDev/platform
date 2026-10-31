import { Effect, Predicate } from "effect";

export function requestOutcome<A, E, R>(request: Effect.Effect<A, E, R>) {
	return request.pipe(
		Effect.match({
			onFailure: (error) => {
				if (Predicate.isTagged(error, "Unauthorized")) {
					return "sign in required" as const;
				}
				if (Predicate.isTagged(error, "Forbidden")) {
					return "permission denied" as const;
				}
				if (Predicate.isTagged(error, "LastRoleAssigner")) {
					return "last owner" as const;
				}
				throw error;
			},
			onSuccess: () => "allowed" as const,
		}),
	);
}
