import { Clock, Effect } from "effect";
import { useEffect, useRef } from "react";
import { useMainLocation } from "./MainLocationContext.ts";

export interface VisualSource {
	readonly alt: string;
	readonly local: string;
	readonly src: string;
}
export interface VisualSelection {
	readonly drawing?: SVGSVGElement;
	readonly images: readonly VisualSource[];
	readonly origin: HTMLElement;
	readonly selected: number;
}
export function useVisualSources(inspect: (selection: VisualSelection) => void) {
	const page = useMainLocation();
	const revisionRef = useRef(0);
	useEffect(() => {
		function refresh() {
			revisionRef.current += 1;
			for (const graphic of document.querySelectorAll<HTMLImageElement>("#doc img[data-local-image]")) {
				graphic.tabIndex = 0;
				graphic.setAttribute("role", "button");
				graphic.setAttribute("aria-label", `Inspect image: ${graphic.alt || "Local image"}`);
				const url = new URL(graphic.dataset.localImage ?? graphic.src, location.href);
				url.searchParams.set("_wb", `${Effect.runSync(Clock.currentTimeMillis)}-${revisionRef.current}`);
				graphic.src = url.href;
				graphic.onerror = () => {
					if (!graphic.isConnected || graphic.nextElementSibling?.hasAttribute("data-image-error")) {
						return;
					}
					const error = document.createElement("span");
					error.setAttribute("data-image-error", "");
					error.setAttribute("role", "status");
					error.textContent = "Image unavailable. Check the local path, supported type, workspace boundary and 16 MiB limit.";
					graphic.after(error);
				};
				graphic.onload = () => {
					if (graphic.nextElementSibling?.hasAttribute("data-image-error")) {
						graphic.nextElementSibling.remove();
					}
				};
			}
		}
		function image(source: HTMLImageElement) {
			const images = [...document.querySelectorAll<HTMLImageElement>("#doc img[data-local-image]")];
			inspect({
				images: images.map((entry) => ({ alt: entry.alt, local: entry.dataset.localImage ?? entry.src, src: entry.src })),
				origin: source,
				selected: images.indexOf(source),
			});
		}
		function click(event: MouseEvent) {
			if (
				event.defaultPrevented
				|| event.button !== 0
				|| event.ctrlKey
				|| event.metaKey
				|| event.shiftKey
				|| event.altKey
				|| !(event.target instanceof Element)
			) {
				return;
			}
			inspectTarget(event, event.target);
		}
		function inspectTarget(event: MouseEvent, target: Element) {
			const trigger = target.closest<HTMLButtonElement>("#doc [data-inspect-diagram]");
			const drawing = trigger?.closest("figure")?.querySelector("svg");
			if (trigger && !trigger.disabled && drawing) {
				inspect({ drawing, images: [], origin: trigger, selected: -1 });
				return;
			}
			const link = target.closest<HTMLAnchorElement>('#doc a[href^="/_board/attachment/"]');
			if (link && !link.hasAttribute("download") && (!link.target || link.target === "_self")) {
				event.preventDefault();
				inspect({
					images: [{ alt: link.textContent ?? "", local: link.getAttribute("href") ?? link.href, src: link.href }],
					origin: link,
					selected: 0,
				});
				return;
			}
			const source = target.closest<HTMLImageElement>("#doc img[data-local-image]");
			if (source) {
				event.preventDefault();
				image(source);
			}
		}
		function key(event: KeyboardEvent) {
			if (["Enter", " "].includes(event.key) && event.target instanceof HTMLImageElement && event.target.matches("#doc img[data-local-image]")) {
				event.preventDefault();
				image(event.target);
			}
		}
		document.addEventListener("click", click);
		document.addEventListener("keydown", key);
		if (page.route) {
			refresh();
		}
		return () => {
			document.removeEventListener("click", click);
			document.removeEventListener("keydown", key);
		};
	}, [inspect, page]);
}
