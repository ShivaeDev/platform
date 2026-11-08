import { CatchBoundary } from "@tanstack/react-router";
import { createElement, type ReactNode, useContext } from "react";
import { isForbidden } from "@shivaedev/errors/taxonomy.ts";
import type { PermissionSession } from "@shivaedev/identity/PermissionSession.ts";
import { PermissionContext } from "#client/adapters/PermissionContext.ts";

export interface PermissionBoundaryProps {
	readonly children: ReactNode;
	readonly fallback: ReactNode;
	readonly session: PermissionSession | null | undefined;
}

export function PermissionBoundaryError({ error }: { readonly error: unknown }): ReactNode {
	const context = useContext(PermissionContext);
	if (!isForbidden(error)) {
		throw error;
	}
	return context?.fallback;
}

export function PermissionBoundary({ children, fallback, session }: PermissionBoundaryProps): ReactNode {
	return createElement(
		PermissionContext.Provider,
		{ value: { fallback, session } },
		createElement(CatchBoundary, { children, errorComponent: PermissionBoundaryError, getResetKey: () => "permission" }),
	);
}
