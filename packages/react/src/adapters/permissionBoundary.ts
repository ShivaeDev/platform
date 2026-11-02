import { CatchBoundary } from "@tanstack/react-router";
import { createElement, type ReactNode, useContext } from "react";
import type { Permission } from "@shivaedev/access/permission.ts";
import { isForbidden } from "@shivaedev/errors/taxonomy.ts";
import { PermissionContext } from "#internal/PermissionContext.ts";
import { can, type PermissionSession } from "#permissions.ts";

export interface PermissionBoundaryProps {
	readonly children: ReactNode;
	readonly fallback: ReactNode;
	readonly session: PermissionSession | null | undefined;
}

export function useCan(): (permission: Permission) => boolean {
	const context = useContext(PermissionContext);
	return (permission) => can(context?.session, permission);
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
