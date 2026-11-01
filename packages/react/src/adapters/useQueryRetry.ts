import { type AnyRouteMatch, useMatch, useRouter } from "@tanstack/react-router";

export function useQueryRetry(refresh: (match: AnyRouteMatch) => void): () => Promise<void> {
	const router = useRouter();
	const match = useMatch({ strict: false });
	return () => {
		refresh(match);
		return router.invalidate({ filter: (candidate) => candidate.id === match.id });
	};
}
