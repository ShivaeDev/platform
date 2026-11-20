import { Clock, Context, Data, Effect, Option, Schema } from "effect";
import { Permission } from "@shivaedev/access/permission.ts";
import { clearStoredQueries } from "@shivaedev/contract/adapters/queryPersistence.ts";
import { QueryStorageProvider } from "@shivaedev/contract/QueryStorage.ts";

export class SessionMemoryUnavailable extends Data.TaggedError("SessionMemoryUnavailable")<{ readonly cause: unknown }> {}

export class SessionMemory extends Context.Service<
	SessionMemory,
	{
		readonly clear: Effect.Effect<void, SessionMemoryUnavailable>;
		readonly read: Effect.Effect<string | null, SessionMemoryUnavailable>;
		readonly write: (value: string) => Effect.Effect<void, SessionMemoryUnavailable>;
	}
>()("@shivaedev/identity/SessionMemory") {}

export interface VerifiedSession {
	readonly session: { readonly expiresAt: Date; readonly id: string };
	readonly user: { readonly id: string; readonly permissions?: readonly Permission[] | undefined };
}

export const RememberedSession = Schema.Struct({
	session: Schema.Struct({ expiresAt: Schema.DateFromString, id: Schema.String }),
	user: Schema.Struct({ id: Schema.String, permissions: Schema.optionalKey(Schema.Array(Permission)) }),
});
export type RememberedSession = typeof RememberedSession.Type;

const Stored = Schema.fromJsonString(RememberedSession);
const decodeStored = Schema.decodeEffect(Stored);
const encodeStored = Schema.encodeEffect(Stored);

// A Layer that also supplies query storage gets the device's stored query results wiped with the memory, by every path that forgets.
export const forgetSession: Effect.Effect<void, never, SessionMemory> = Effect.gen(function* () {
	const memory = yield* SessionMemory;
	yield* Effect.ignore(memory.clear);
	const queries = yield* Effect.serviceOption(QueryStorageProvider);
	if (Option.isSome(queries)) {
		yield* clearStoredQueries().pipe(Effect.provideService(QueryStorageProvider, queries.value));
	}
});

const stored = Effect.gen(function* () {
	const memory = yield* SessionMemory;
	const value = yield* Effect.orElseSucceed(memory.read, () => null);
	return value === null ? Option.none<RememberedSession>() : yield* Effect.option(decodeStored(value));
});

export const recallSession: Effect.Effect<Option.Option<RememberedSession>, never, SessionMemory> = Effect.gen(function* () {
	const remembered = yield* stored;
	const now = yield* Clock.currentTimeMillis;
	const current = Option.filter(remembered, ({ session }) => session.expiresAt.getTime() > now);
	if (Option.isNone(current)) {
		yield* forgetSession;
	}
	return current;
});

export const rememberSession = Effect.fnUntraced(function* (answer: VerifiedSession | null) {
	if (answer === null) {
		yield* forgetSession;
		return null;
	}
	const { permissions } = answer.user;
	const remembered: RememberedSession = {
		session: { expiresAt: answer.session.expiresAt, id: answer.session.id },
		user: { id: answer.user.id, ...(permissions === undefined ? {} : { permissions }) },
	};
	const previous = yield* stored;
	if (Option.exists(previous, ({ user }) => user.id !== remembered.user.id)) {
		yield* forgetSession;
	}
	const memory = yield* SessionMemory;
	yield* encodeStored(remembered).pipe(Effect.flatMap(memory.write), Effect.ignore);
	return remembered;
});
