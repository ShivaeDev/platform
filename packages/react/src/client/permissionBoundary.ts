import { CatchBoundary } from "@tanstack/react-router";
import { Predicate } from "effect";
import { createElement, type ReactNode, useContext } from "react";
import type { Permission } from "@shivaedev/access/permission.ts";
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

function PermissionFailure({ error }: { readonly error: unknown }): ReactNode {
	const context = useContext(PermissionContext);
	if (!Predicate.isTagged(error, "Forbidden")) {
		throw error;
	}
	return context?.fallback;
}

export function PermissionBoundary({ children, fallback, session }: PermissionBoundaryProps): ReactNode {
	return createElement(
		PermissionContext.Provider,
		{ value: { fallback, session } },
		createElement(CatchBoundary, { children, errorComponent: PermissionFailure, getResetKey: () => "permission" }),
	);
}
