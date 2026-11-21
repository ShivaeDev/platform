import { useRouter, useRouterState } from "@tanstack/react-router";
import { Children, type ReactElement, type ReactNode } from "react";
import { Notices } from "#client/Notices.tsx";

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		readonly fullScreen?: boolean;
	}
}

export function Shell({ children }: { readonly children: ReactNode }): ReactElement {
	const pending = useRouterState({ select: (state) => state.isLoading });
	const router = useRouter();
	const fullScreen = useRouterState({
		select: (state) =>
			// The first load shows no match until it finishes, so the shell reads the routes that location will show.
			state.matches.length > 0
				? state.matches.some((match) => match.staticData.fullScreen === true)
				: router.getMatchedRoutes(state.location.pathname)[0].some((route) => route.options.staticData?.fullScreen === true),
	});
	const loading = pending && <p role="status">Loading…</p>;
	const modules = router.options.context?.modules ?? [];
	const menu = Children.toArray(modules.map((module) => module.menu));
	const overlays = Children.toArray(modules.map((module) => module.overlays));
	const footer = Children.toArray(modules.map((module) => Children.toArray(module.footer)));
	const navigation = !fullScreen && menu.length > 0 && <nav aria-label="Main">{menu}</nav>;
	const footerContent = !fullScreen && footer.length > 0 && <footer>{footer}</footer>;
	return (
		<Notices>
			{navigation}
			{loading}
			{children}
			{overlays}
			{footerContent}
		</Notices>
	);
}
