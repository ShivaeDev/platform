import { Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { foundationRegistration } from "#client/admin/foundationRegistration.tsx";
import { type AppConnection, type ClientRegistration, connectModules } from "#client/Module.ts";
import { notesRegistration } from "#modules/notes/client/registration.tsx";

const modules = [foundationRegistration, notesRegistration] as const;
type Registered = Effect.Success<ReturnType<(typeof modules)[number]>>;

export function clientModules(
	session: { readonly id: string },
	registrations: readonly ClientRegistration[],
): Effect.Effect<AppConnection, never, AtomRegistry.AtomRegistry>;
export function clientModules(session: {
	readonly id: string;
}): Effect.Effect<AppConnection<readonly Registered[]>, never, AtomRegistry.AtomRegistry>;
export function clientModules(
	_session: { readonly id: string },
	registrations: readonly ClientRegistration[] = modules.map((register) => register()),
): Effect.Effect<AppConnection, never, AtomRegistry.AtomRegistry> {
	return Effect.map(Effect.all(registrations), connectModules);
}
