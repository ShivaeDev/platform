import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "#client/react/components/ui/dialog.tsx";
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
	const close = useCallback(() => setSelection(undefined), []);
	useEffect(() => {
		window.addEventListener("pagehide", close);
		return () => window.removeEventListener("pagehide", close);
	}, [close]);
	return (
		<Dialog
			onOpenChange={(next) => {
				if (!next) {
					close();
				}
			}}
			open={selection !== undefined}
		>
			<DialogContent
				aria-describedby={undefined}
				aria-labelledby={shellIds.visualTitle}
				className="max-h-[90dvh] overflow-auto text-sm sm:max-w-5xl"
				finalFocus={() => (originRef.current?.isConnected ? originRef.current : document.getElementById("doc"))}
				id={shellIds.visualDialog}
				showCloseButton={false}
			>
				{selection ? <VisualViewer close={close} key={selection.origin.dataset.localImage ?? "drawing"} selection={selection} /> : null}
			</DialogContent>
		</Dialog>
	);
}
