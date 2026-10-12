import { createElement, useEffect, useId, useState } from "react";

type Drawing = { readonly source: string; readonly svg: string } | { readonly source: string; readonly error: string };

export function Mermaid({ source }: { readonly source: string }) {
	const id = useId().replace(/[^a-z\d_-]/giu, "");
	const [drawing, setDrawing] = useState<Drawing>();
	const [theme, setTheme] = useState(() => document.documentElement.dataset.scheme ?? "light");
	useEffect(() => {
		function sync() {
			setTheme(document.documentElement.dataset.scheme ?? "light");
		}
		document.addEventListener("board-theme", sync);
		return () => document.removeEventListener("board-theme", sync);
	}, []);
	useEffect(() => {
		let current = true;
		async function draw() {
			try {
				const { default: mermaid } = await import("mermaid");
				function token(name: string) {
					return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
				}
				mermaid.initialize({
					securityLevel: "strict",
					startOnLoad: false,
					suppressErrorRendering: true,
					theme: "base",
					themeVariables: {
						background: token("--bg"),
						darkMode: theme === "dark",
						fontFamily: token("--sans"),
						lineColor: token("--muted"),
						primaryBorderColor: token("--border"),
						primaryColor: token("--surface"),
						primaryTextColor: token("--text"),
						textColor: token("--text"),
					},
				});
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
	}, [id, source, theme]);
	const shown = drawing?.source === source || (drawing && "svg" in drawing) ? drawing : undefined;
	const state = drawingState(shown, source);
	return createElement(
		"figure",
		{ className: "diagram", "data-error": shown && "error" in shown ? shown.error : undefined, "data-react-diagram": "", "data-state": state },
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

function drawingState(shown: Drawing | undefined, source: string): string {
	if (!shown) {
		return "pending";
	}
	if ("error" in shown) {
		return "failed";
	}
	return shown.source === source ? "drawn" : "redrawing";
}
