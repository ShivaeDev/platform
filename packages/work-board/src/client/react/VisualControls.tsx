import { shellIds } from "./shellIds.ts";

interface ControlsProps {
	readonly baseWidth: number;
	readonly count: number;
	readonly filename: string;
	readonly href: string | undefined;
	readonly image: boolean;
	readonly onActual: () => void;
	readonly onFit: () => void;
	readonly onFullscreen: () => void;
	readonly onMove: (offset: number) => void;
	readonly onZoom: (scale: number) => void;
	readonly scale: number;
	readonly selected: number;
}
export function VisualControls({
	selected,
	count,
	image,
	scale,
	baseWidth,
	href,
	filename,
	onMove,
	onZoom,
	onFit,
	onActual,
	onFullscreen,
}: ControlsProps) {
	return (
		<fieldset aria-label="Visual controls" className="visual-bar">
			<button disabled={selected <= 0} hidden={!image} id={shellIds.visualPrevious} onClick={() => onMove(-1)} type="button">
				Previous image
			</button>
			<button disabled={selected >= count - 1} hidden={!image} id={shellIds.visualNext} onClick={() => onMove(1)} type="button">
				Next image
			</button>
			<button aria-label="Zoom out" id={shellIds.visualOut} onClick={() => onZoom(Math.max(25, scale / 1.5))} type="button">
				−
			</button>
			<button id={shellIds.visualFit} onClick={onFit} type="button">
				{scale === 100 && !baseWidth ? "Fit" : `${Math.round(scale)}% · Fit`}
			</button>
			<button aria-pressed={Boolean(baseWidth)} id={shellIds.visualActual} onClick={onActual} type="button">
				Actual size
			</button>
			<button aria-label="Zoom in" id={shellIds.visualIn} onClick={() => onZoom(Math.min(800, scale * 1.5))} type="button">
				+
			</button>
			<button id={shellIds.visualFullscreen} onClick={onFullscreen} type="button">
				Fullscreen
			</button>
			<a aria-disabled={!href} download={filename} href={href} id={shellIds.visualDownload}>
				Save locally
			</a>
		</fieldset>
	);
}
