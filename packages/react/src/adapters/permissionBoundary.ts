import { type AnyRouter, CatchBoundary, useRouter } from "@tanstack/react-router";
import { createElement, type ReactNode, useContext, useEffect, useRef } from "react";
import type { Permission } from "@shivaedev/access/permission.ts";
import { isForbidden } from "@shivaedev/errors/taxonomy.ts";
import type { PermissionSession } from "@shivaedev/identity/PermissionSession.ts";
import { PermissionContext } from "#adapters/PermissionContext.ts";
import { can } from "#can.ts";

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

function grantKey(session: PermissionSession | null | undefined) {
	return (session?.user.permissions ?? [])
		.map((grant) => `${grant.name}:${grant.strength}`)
		.sort()
		.join(",");
}

// Route guards read the session when a navigation loads, so a session refreshed in place reruns them here.
function useGuardRerun(session: PermissionSession | null | undefined) {
	const router: AnyRouter | undefined = useRouter({ warn: false });
	const grants = grantKey(session);
	const guardedRef = useRef(grants);
	useEffect(() => {
		if (guardedRef.current !== grants) {
			guardedRef.current = grants;
			void router?.invalidate();
		}
	}, [router, grants]);
}

export function PermissionBoundary({ children, fallback, session }: PermissionBoundaryProps): ReactNode {
	useGuardRerun(session);
	return createElement(
		PermissionContext.Provider,
		{ value: { fallback, session } },
		createElement(CatchBoundary, { children, errorComponent: PermissionBoundaryError, getResetKey: () => "permission" }),
	);
}
