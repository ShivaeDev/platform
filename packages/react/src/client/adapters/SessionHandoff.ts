import { type ReactNode, useEffect, useState } from "react";

function safeDestination(target: string): string {
	try {
		const url = new URL(target, window.location.origin);
		return (url.protocol === "http:" || url.protocol === "https:") && url.origin === window.location.origin && !url.pathname.startsWith("//")
			? `${url.pathname}${url.search}${url.hash}`
			: "/";
	} catch {
		return "/";
	}
}

function replaceLocation(href: string): void {
	window.history.replaceState(null, "", href);
}

export function SessionHandoff({
	children,
	redirectTo,
	navigate = replaceLocation,
}: {
	readonly children?: ReactNode;
	readonly redirectTo: string | undefined;
	readonly navigate: ((href: string) => void) | undefined;
}): ReactNode {
	const [ready, setReady] = useState(redirectTo === undefined);
	// The signed-out router must finish unmounting before any history listener sees the destination.
	useEffect(() => {
		if (!ready && redirectTo !== undefined) {
			navigate(safeDestination(redirectTo));
			setReady(true);
		}
	}, [ready, redirectTo, navigate]);
	return ready ? children : null;
}
