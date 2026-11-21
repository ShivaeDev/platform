import { RegistryContext } from "@effect/atom-react";
import { Option } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { Children, useContext, useState } from "react";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import type { AppConnection, ClientApp } from "#client/app.ts";
import { useAction, useQuery } from "#client/resultState.ts";
import type { Counter, Profile } from "#test/client-app/backend.ts";

export function CountView({ counter, name }: { counter: ContractClient<typeof Counter>; name: string }) {
	const count = useQuery(counter.count.query());
	return (
		<output aria-label={name} data-pending={count.pending}>
			{Option.getOrElse(Option.map(count.data, String), () => "Loading")}
		</output>
	);
}

export function BumpButton({ bump }: { bump: Atom.AtomResultFn<void, void, unknown> }) {
	const action = useAction(bump);
	return (
		<button disabled={action.pending} onClick={() => action.dispatch(undefined)} type="button">
			Bump
		</button>
	);
}

export function ViewerView({ profile }: { profile: ContractClient<typeof Profile> }) {
	const viewer = useQuery(profile.viewer.query());
	return <output data-pending={viewer.pending}>{Option.getOrElse(viewer.data, () => "Loading")}</output>;
}

export function Shell({ connection }: { readonly connection: AppConnection }) {
	return (
		<>
			<nav>{Children.toArray(connection.modules.map((module) => module.menu))}</nav>
			{Children.toArray(connection.modules.map((module) => module.overlays))}
			<footer>{Children.toArray(connection.modules.map((module) => Children.toArray(module.footer)))}</footer>
		</>
	);
}

export function SignedOut({ app, record }: { readonly app: ClientApp; readonly record: (connection: AppConnection) => AppConnection }) {
	const registry = useContext(RegistryContext);
	const [connection] = useState(() => record(app.connect(undefined, registry)));
	return <Shell connection={connection} />;
}
