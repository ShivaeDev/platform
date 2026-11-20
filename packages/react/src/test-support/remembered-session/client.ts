import { Clock, Effect, Layer } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Permission } from "@shivaedev/access/permission.ts";
import { authSession as readSession } from "@shivaedev/identity/client/adapters/authSession.ts";
import { browserSessionMemory } from "@shivaedev/identity/client/adapters/browserSessionMemory.ts";
import { rememberSession, SessionMemory } from "@shivaedev/identity/client/SessionMemory.ts";
import { memoryQueryStorage } from "@shivaedev/test-kits/contract/memoryQueryStorage.ts";
import { authSession } from "#client/authSession.ts";

export type User = "alice" | "bob";

export interface ProviderSession {
	readonly session: { readonly expiresAt: Date; readonly id: string; readonly token: string; readonly userId: string };
	readonly user: { readonly email: string; readonly id: User; readonly name: string; readonly permissions: readonly Permission[] };
}

interface Read {
	readonly reject: (cause: unknown) => void;
	readonly resolve: (value: { readonly data: ProviderSession | null; readonly error: null }) => void;
}

export interface Generation {
	readonly number: number;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly user: string;
}

export function providerSession(user: User, grants: readonly string[], expiresAt: number): ProviderSession {
	return {
		session: { expiresAt: new Date(expiresAt), id: `${user}-session`, token: `${user}-secret-token`, userId: user },
		user: {
			email: `${user}@example.test`,
			id: user,
			name: user,
			permissions: grants.map((name) => ({ name, strength: "any" })),
		},
	};
}

export function rememberedClient(clock: Clock.Clock) {
	const queries = memoryQueryStorage();
	const memory = Layer.mergeAll(browserSessionMemory, Layer.succeed(Clock.Clock, clock), queries.layer);
	const reads: Read[] = [];
	const generations: Generation[] = [];
	const signOuts: (() => void)[] = [];
	function latest() {
		const read = reads.at(-1);
		if (read === undefined) {
			throw new Error("No session check is on the wire");
		}
		return read;
	}
	return {
		answer: (session: ProviderSession | null) => latest().resolve({ data: session, error: null }),
		answerSignOut: () => signOuts.shift()?.(),
		fail: () => latest().reject(new TypeError("Failed to fetch")),
		generations,
		memory,
		queries,
		reads,
		remember: (session: ProviderSession) => Effect.provide(rememberSession(session), memory),
		session: () =>
			authSession(
				readSession(
					(_signal) =>
						new Promise<{ readonly data: ProviderSession | null; readonly error: null }>((resolve, reject) => reads.push({ reject, resolve })),
				),
				{ remember: memory },
			),
		signOutRequest: Effect.promise(() => new Promise<void>((resolve) => signOuts.push(resolve))),
		stored: Effect.gen(function* () {
			const store = yield* SessionMemory;
			return yield* store.read;
		}).pipe(Effect.provide(memory)),
	};
}
export type RememberedClient = ReturnType<typeof rememberedClient>;
