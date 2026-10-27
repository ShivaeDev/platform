import type { authQuery } from "#client/authQuery.ts";
import { useQuery } from "#client/resultState.ts";

interface AuthError {
	readonly code: "REFUSED";
	readonly status: number;
}
export function AuthRead({ query }: { readonly query: ReturnType<ReturnType<typeof authQuery<string, string | null, AuthError>>> }) {
	const state = useQuery(query);
	return <output>{JSON.stringify({ cause: state.cause, data: state.data, pending: state.pending })}</output>;
}
