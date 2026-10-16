import { useEffect, useRef, useState } from "react";
import { KeyboardHints } from "./KeyboardHints.tsx";
import { shellIds } from "./shellIds.ts";
import { VisualControls } from "./VisualControls.tsx";
import { graphicWidth, visualFilename } from "./visualDimensions.ts";
import type { VisualSelection } from "./visualSources.ts";

export function VisualViewer({ selection, close }: { readonly selection: VisualSelection; readonly close: () => void }) {
	const [selected, setSelected] = useState(selection.selected);
	const [scale, setScale] = useState(100);
	const [baseWidth, setBaseWidth] = useState(0);
	const [status, setStatus] = useState("");
	const [stale, setStale] = useState(false);
	const [objectUrl, setObjectUrl] = useState<string>();
	const stageRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const image = selection.images[selected];
	useEffect(() => {
		if (!selection.drawing) {
			return;
		}
		const copy = selection.drawing.cloneNode(true);
		contentRef.current?.replaceChildren(copy);
		const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(selection.drawing)], { type: "image/svg+xml" }));
		setObjectUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [selection.drawing]);
	useEffect(() => {
		function changed() {
			setStale(true);
			setStatus("Source updated. This preview is the drawing/image opened earlier; close and reopen to inspect or save the latest source.");
		}
		document.addEventListener("board-page", changed);
		return () => document.removeEventListener("board-page", changed);
	}, []);
	function handleFitVisual() {
		setBaseWidth(0);
		setScale(100);
		if (viewportRef.current) {
			viewportRef.current.scrollTop = 0;
			viewportRef.current.scrollLeft = 0;
		}
	}
	function handleMove(offset: number) {
		setSelected((current) => Math.max(0, Math.min(selection.images.length - 1, current + offset)));
		handleFitVisual();
		setStatus("");
	}
	function handleActual() {
		const graphic = contentRef.current?.firstElementChild;
		const width = graphicWidth(graphic);
		if (!width) {
			setStatus("Original dimensions unavailable; Fit and zoom remain available.");
			return;
		}
		setBaseWidth(width);
		setScale(100);
	}
	async function handleFullscreen() {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			} else {
				await stageRef.current?.requestFullscreen();
			}
		} catch {
			setStatus("Fullscreen is unavailable here; the scrollable viewer remains available.");
		}
	}
	useEffect(() => {
		const stage = stageRef.current;
		const graphic = contentRef.current?.querySelector("img");
		if (viewportRef.current) {
			viewportRef.current.tabIndex = 0;
		}
		function failed() {
			setStatus("Image unavailable. Check the local path, supported type, workspace boundary and 16 MiB limit.");
		}
		function key(event: KeyboardEvent) {
			if (selected < 0 || !["ArrowLeft", "ArrowRight"].includes(event.key)) {
				return;
			}
			event.preventDefault();
			setSelected((current) => Math.max(0, Math.min(selection.images.length - 1, current + (event.key === "ArrowLeft" ? -1 : 1))));
			setBaseWidth(0);
			setScale(100);
			setStatus("");
		}
		stage?.addEventListener("keydown", key);
		graphic?.addEventListener("error", failed);
		return () => {
			stage?.removeEventListener("keydown", key);
			graphic?.removeEventListener("error", failed);
		};
	}, [selected, selection.images.length]);
	useEffect(
		() => () => {
			if (stageRef.current?.contains(document.fullscreenElement)) {
				void document.exitFullscreen().catch(() => undefined);
			}
		},
		[],
	);

	const href = stale || status.startsWith("Image unavailable") ? undefined : (image?.local ?? objectUrl);
	const filename = visualFilename(image?.local);
	return (
		<div id={shellIds.visualStage} ref={stageRef}>
			<div className="visual-bar">
				<h2 id={shellIds.visualTitle}>Visual evidence</h2>
				<button id={shellIds.visualClose} onClick={() => close()} type="button">
					Close
				</button>
			</div>
			<p id={shellIds.visualContext}>
				{image ? `${image.alt || "Local image"} · ${selected + 1} of ${selection.images.length} · ${image.local}` : "Mermaid diagram"} ·{" "}
				{document.getElementById("doc")?.dataset.file}
				{image ? "" : " · Current drawing"}
			</p>
			<VisualControls
				baseWidth={baseWidth}
				count={selection.images.length}
				filename={filename}
				href={href}
				image={image !== undefined}
				onActual={handleActual}
				onFit={handleFitVisual}
				onFullscreen={handleFullscreen}
				onMove={handleMove}
				onZoom={setScale}
				scale={scale}
				selected={selected}
			/>
			<p id={shellIds.visualStatus} role="status">
				{status}
			</p>
			<section aria-label="Scrollable visual" id={shellIds.visualViewport} ref={viewportRef}>
				<div id={shellIds.visualContent} ref={contentRef} style={{ width: baseWidth ? `${(baseWidth * scale) / 100}px` : `${scale}%` }}>
					{image ? <img alt={image.alt} src={image.src} /> : null}
				</div>
			</section>
			<p className="visual-help">
				<KeyboardHints>Arrow keys choose images · Escape returns to the source. </KeyboardHints>
				Zoom and scroll to inspect. Recorded evidence does not verify acceptance.
			</p>
		</div>
	);
}
