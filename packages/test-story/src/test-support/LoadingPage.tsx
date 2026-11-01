import { act, type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type LoadingIndicator = "status" | "busy" | "root busy" | "text" | "text dots" | "dialog" | "native dialog" | "closed dialog" | "none";

function loadingNotice(indicator: LoadingIndicator, hidden: boolean): ReactNode {
	switch (indicator) {
		case "dialog":
			return createPortal(
				<section hidden={hidden} role="dialog">
					Preparing
				</section>,
				document.body,
			);
		case "native dialog":
		case "closed dialog":
			return createPortal(
				<dialog hidden={hidden} open={indicator === "native dialog"}>
					Loading…
				</dialog>,
				document.body,
			);
		case "status":
		case "busy":
			return (
				<p aria-busy={indicator === "busy" || undefined} hidden={hidden} role={indicator === "status" ? "status" : undefined}>
					Preparing
				</p>
			);
		case "text":
		case "text dots":
			return <p hidden={hidden}>{indicator === "text" ? "Loading…" : "Loading..."}</p>;
		case "root busy":
		case "none":
			return null;
	}
}

export function LoadingPage({
	delay,
	indicator,
	hidden = false,
	missing = false,
}: {
	readonly delay: number;
	readonly hidden?: boolean;
	readonly indicator: LoadingIndicator;
	readonly missing?: boolean;
}) {
	const [ready, setReady] = useState(false);
	const [saved, setSaved] = useState(false);
	useEffect(() => {
		const timer = setTimeout(() => {
			act(() => setReady(true));
		}, delay);
		return () => clearTimeout(timer);
	}, [delay]);
	const loading = ready ? null : loadingNotice(indicator, hidden);
	const control =
		ready && !missing ? (
			<button onClick={() => setSaved(true)} type="button">
				Save
			</button>
		) : null;
	return (
		<main aria-busy={(indicator === "root busy" && !ready) || undefined}>
			{loading}
			<section className="controls">{control}</section>
			<p>{saved ? "Saved" : "Unsaved"}</p>
		</main>
	);
}
