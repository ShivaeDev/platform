import { useRouter, useRouterState } from "@tanstack/react-router";
import { Children, type ReactElement, type ReactNode } from "react";
import { Forbidden } from "@shivaedev/react/adapters/Forbidden.ts";
import { PermissionBoundary } from "@shivaedev/react/client/adapters/permissionBoundary.ts";

export function Shell({ children }: { readonly children: ReactNode }): ReactElement {
	const pending = useRouterState({ select: (state) => state.isLoading });
	const loading = pending && <p role="status">Loading…</p>;
	const router = useRouter();
	const modules = router.options.context?.modules ?? [];
	const menu = Children.toArray(modules.map((module) => module.menu));
	const overlays = Children.toArray(modules.map((module) => module.overlays));
	const footer = Children.toArray(modules.map((module) => Children.toArray(module.footer)));
	const navigation = menu.length > 0 && <nav aria-label="Main">{menu}</nav>;
	const footerContent = footer.length > 0 && <footer>{footer}</footer>;
	return (
		<PermissionBoundary
			fallback={<Forbidden backLabel="Back to home" className="space-y-4 p-8 [&_a]:underline [&_h1]:text-3xl [&_h1]:font-semibold" to="/" />}
			session={router.options.context?.session()}
		>
			{navigation}
			{loading}
			{children}
			{overlays}
			{footerContent}
		</PermissionBoundary>
	);
}
