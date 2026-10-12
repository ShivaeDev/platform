import { createElement, useEffect, useId, useState } from "react";

type Drawing = { readonly source: string; readonly svg: string } | { readonly source: string; readonly error: string };

export function Mermaid({ source }: { readonly source: string }) {
	const id = useId().replace(/[^a-z\d_-]/giu, "");
	const [drawing, setDrawing] = useState<Drawing>();
	useEffect(() => {
		let current = true;
		async function draw() {
			try {
				const { default: mermaid } = await import("mermaid");
				mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true });
				const { svg } = await mermaid.render(`document-diagram-${id}`, source);
				if (current) {
					setDrawing({ source, svg });
				}
			} catch (error) {
				if (current) {
					setDrawing({ error: error instanceof Error ? error.message : String(error), source });
				}
			}
		}
		void draw();
		return () => {
			current = false;
		};
	}, [id, source]);
	const shown = drawing?.source === source ? drawing : undefined;
	let state = "pending";
	if (shown) {
		state = "svg" in shown ? "drawn" : "failed";
	}
	return createElement(
		"figure",
		{ className: "diagram", "data-state": state },
		shown && "svg" in shown
			? createElement("div", {
					className: "diagram-svg",
					ref: (element: HTMLDivElement | null) => {
						if (element) {
							const svg = new DOMParser().parseFromString(shown.svg, "image/svg+xml").documentElement;
							element.replaceChildren(document.importNode(svg, true));
						}
					},
				})
			: null,
		createElement("pre", { className: "diagram-source" }, source),
		shown && "error" in shown ? createElement("p", { "data-diagram-error": "", role: "status" }, `Diagram could not be drawn: ${shown.error}`) : null,
	);
}
