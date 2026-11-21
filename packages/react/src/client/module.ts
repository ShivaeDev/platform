import type { AnyRoute } from "@tanstack/react-router";
import type * as Atom from "effect/reactivity/Atom";
import type { ReactNode } from "react";
import type { Permission } from "@shivaedev/access/permission.ts";
import type { ContractClients, Contracts } from "@shivaedev/contract/makeClient.ts";

// The application declares a required root once, overriding the optional one, as TanStack Router's own Register works.
export interface Register extends Partial<Record<"root", AnyRoute>> {}

export type RootRoute = Register extends { readonly root: infer TRoot extends AnyRoute } ? TRoot : AnyRoute;

export interface AdminNavigation {
	readonly id: string;
	readonly route: { readonly path: string; readonly detail?: string; readonly permission: Permission; readonly title: string };
}

export interface ModuleParts<TRoute extends AnyRoute = AnyRoute> {
	readonly admin?: { readonly pages: readonly AdminNavigation[] };
	readonly footer?: ReactNode;
	readonly menu?: readonly ReactNode[];
	readonly overlays?: readonly ReactNode[];
	readonly routes?: (root: RootRoute) => readonly TRoute[];
	readonly warm?: readonly Atom.Atom<unknown>[];
}

// The app hands each module the bindings of whichever contracts it names, so a module's clients keep its own contracts' types.
export type BindContracts = <TContracts extends Contracts>(contracts: TContracts) => ContractClients<TContracts>;

export interface ClientModule<TRoute extends AnyRoute = AnyRoute> {
	readonly connect: (clientsFor: BindContracts) => ModuleParts<TRoute>;
	readonly contracts: Contracts;
}

export function clientModule<const TContracts extends Contracts, TRoute extends AnyRoute = never>(
	contracts: TContracts,
	connect: (clients: ContractClients<TContracts>) => ModuleParts<TRoute>,
): ClientModule<TRoute> {
	return { connect: (clientsFor) => connect(clientsFor(contracts)), contracts };
}
