import type { AnyRoute } from "@tanstack/react-router";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { ReactNode } from "react";
import type { Permission } from "@shivaedev/access/permission.ts";
import type { ContractClients, Contracts } from "@shivaedev/contract/makeClient.ts";
import type { PermissionSession } from "@shivaedev/identity/PermissionSession.ts";
import type { sessionRoot } from "#client/sessionRoot.ts";

export interface SessionAuth {
	readonly signOut: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>;
}

export type SessionUser = PermissionSession & { readonly user: { readonly id: string } };

// The application declares its auth and session types once, overriding the optional ones, as TanStack Router's own Register works.
export interface Register extends Partial<{ readonly auth: SessionAuth; readonly session: SessionUser }> {}

export type RegisteredAuth = Register extends { readonly auth: infer TAuth extends SessionAuth } ? TAuth : SessionAuth;

export type RegisteredSession = Register extends { readonly session: infer TSession extends SessionUser } ? TSession : SessionUser;

export type RootRoute = ReturnType<typeof sessionRoot>;

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
