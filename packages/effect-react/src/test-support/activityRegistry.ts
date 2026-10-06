import { RegistryContext, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { Activity, act, createElement, useContext, useState } from "react";
import { createRoot } from "react-dom/client";
import { SessionBoundary } from "#session-boundary.ts";

interface Held {
	registry?: AtomRegistry.AtomRegistry;
}
interface Entry {
	readonly atom: Atom.Atom<string>;
	readonly name: string;
}

function Value({ atom }: { readonly atom: Atom.Atom<string> }) {
	return createElement("span", null, useAtomValue(atom));
}

function ActivityProbe({ count, atoms, held }: { readonly count: number; readonly atoms: ReadonlyArray<Entry>; readonly held: Held }) {
	held.registry = useContext(RegistryContext);
	const [draft] = useState("retained draft");
	return createElement("output", null, draft, ...atoms.slice(0, count).map(({ atom, name }) => createElement(Value, { atom, key: name })));
}

export function activityRegistry() {
	const container = document.createElement("div");
	const root = createRoot(container);
	const built: string[] = [];
	const finalized: string[] = [];
	const atoms = ["first", "second", "third"].map((name) => ({
		atom: Atom.keepAlive(
			Atom.make((get) => {
				built.push(name);
				get.addFinalizer(() => finalized.push(name));
				return name;
			}),
		),
		name,
	}));
	const held: Held = {};
	return {
		built,
		close: () => act(async () => root.unmount()),
		container,
		finalized,
		registry: () => {
			if (held.registry === undefined) {
				throw new Error("Activity did not render a registry");
			}
			return held.registry;
		},
		render: (mode: "visible" | "hidden", count: number) =>
			act(async () => {
				const boundary = {
					children: () => createElement(ActivityProbe, { atoms, count, held }),
					connect: () => undefined,
					identify: (session: string) => session,
					recheck: () => {
						throw new Error("Unexpected session recheck");
					},
					session: "active-session",
				};
				const activity = { children: createElement(SessionBoundary<string, undefined>, boundary), mode };
				root.render(createElement(Activity, activity));
				await Promise.resolve();
			}),
	};
}
