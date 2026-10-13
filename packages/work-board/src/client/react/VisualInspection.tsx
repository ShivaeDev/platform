import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "./Modal.tsx";
import { shellIds } from "./shellIds.ts";
import { VisualViewer } from "./VisualViewer.tsx";
import { useVisualSources, type VisualSelection } from "./visualSources.ts";

export function VisualInspection() {
	const [selection, setSelection] = useState<VisualSelection>();
	const originRef = useRef<HTMLElement | undefined>(undefined);
	const inspect = useCallback((next: VisualSelection) => {
		originRef.current = next.origin;
		setSelection(next);
	}, []);
	useVisualSources(inspect);
	const close = useCallback(() => {
		setSelection(undefined);
		const origin = originRef.current;
		(origin?.isConnected ? origin : document.getElementById("doc"))?.focus();
	}, []);
	useEffect(() => {
		window.addEventListener("pagehide", close);
		return () => window.removeEventListener("pagehide", close);
	}, [close]);
	return (
		<Modal
			close={close}
			id={shellIds.visualDialog}
			open={selection !== undefined}
			returnFocus={originRef.current?.isConnected ? originRef.current : (document.getElementById("doc") ?? undefined)}
			title="visual-title"
		>
			{selection ? <VisualViewer close={close} key={selection.origin.dataset.localImage ?? "drawing"} selection={selection} /> : null}
		</Modal>
	);
}
