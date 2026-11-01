import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { authCall } from "#client/authAction.ts";
import { authSession } from "#client/authSession.ts";

export interface Session {
	readonly user: { readonly name: string; readonly emailVerified: boolean };
}
export interface Refused {
	readonly code: "FAILED_TO_GET_SESSION";
}
interface Read {
	readonly reject: (cause: unknown) => void;
	readonly resolve: (value: { readonly data: Session | null; readonly error: Refused | null }) => void;
	readonly signal: AbortSignal;
}

export function sessionClient() {
	const signedIn = { user: { emailVerified: false, name: "Alice", permissions: [{ name: "notes.read", strength: "any" }] } };
	let stored: Session | null = signedIn;
	const reads: Read[] = [];
	const session = authSession(
		(signal) => new Promise<{ data: Session | null; error: Refused | null }>((resolve, reject) => reads.push({ reject, resolve, signal })),
	);
	const mutate = authCall((change: "rename" | "verify", _signal) => {
		stored = { user: { emailVerified: change === "verify", name: change === "rename" ? "Alicia" : "Alice" } };
		return Promise.resolve({ data: undefined, error: null });
	});
	const mutation = Atom.fn<"rename" | "verify">()((change) => mutate(change).pipe(Effect.andThen(session.refresh)));
	function latest() {
		const read = reads.at(-1);
		if (!read) {
			throw new Error("No session request");
		}
		return read;
	}
	return {
		answer: () => latest().resolve({ data: stored, error: null }),
		malformPermissions: () => {
			const data = { user: { emailVerified: false, name: "Alice", permissions: [{ name: "notes.read", strength: "invalid" }] } };
			latest().resolve({ data, error: null });
		},
		mutation,
		refuse: () => latest().resolve({ data: null, error: { code: "FAILED_TO_GET_SESSION" } }),
		reject: () => latest().reject("offline"),
		session,
		signOut: () => {
			stored = null;
		},
	};
}
export type SessionClient = ReturnType<typeof sessionClient>;
