import { useEffect, useRef } from "react";
import type { PermissionSession } from "@shivaedev/identity/PermissionSession.ts";

function grantKey(session: PermissionSession | null | undefined) {
	return (session?.user.permissions ?? [])
		.map((grant) => `${grant.name}:${grant.strength}`)
		.sort()
		.join(",");
}

export function useGuardRerun(router: { readonly invalidate: () => Promise<void> }, session: PermissionSession | null | undefined): void {
	const grants = grantKey(session);
	const guardedRef = useRef(grants);
	useEffect(() => {
		if (guardedRef.current !== grants) {
			guardedRef.current = grants;
			void router.invalidate();
		}
	}, [router, grants]);
}
