import { Option } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import { useAction, useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { type Backend, bindPreferences, type Person } from "#test/session-keys/preferences.ts";

function PreferencesScreen({ person, preferences }: { readonly person: Person; readonly preferences: ReturnType<typeof bindPreferences> }) {
	const self = useQuery(preferences.api.self.query());
	const save = useAction(preferences.runtime, preferences.api.save.run);
	const [title, setTitle] = useState("");
	return (
		<section aria-label={person}>
			<output data-pending={self.pending || save.pending}>{Option.getOrElse(self.data, () => "Loading")}</output>
			<input aria-label="Title" onChange={(event) => setTitle(event.target.value)} value={title} />
			<button onClick={() => save.dispatch({ title })} type="button">
				Save
			</button>
		</section>
	);
}

export function TwoSessions({ backend, runtime }: { readonly backend: Backend; readonly runtime: Atom.RuntimeFactory }) {
	return (["alice", "bob"] as const).map((person) => (
		<SessionBoundary
			connect={(_, registry) => bindPreferences(person, backend, runtime, registry)}
			identify={(session) => session}
			key={person}
			recheck={() => undefined}
			session={person}
		>
			{(preferences) => <PreferencesScreen person={person} preferences={preferences} />}
		</SessionBoundary>
	));
}
