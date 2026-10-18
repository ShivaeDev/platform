import { createElement, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { ThemeContext } from "#client/react/ThemeContext.ts";
import { mermaidColor } from "./mermaidColor.ts";

const drawings = new Map<string, { readonly source: string; readonly svg: string }>();

const MAX_DRAWINGS = 30;

type Drawing = { readonly source: string; readonly svg: string } | { readonly source: string; readonly error: string };

export function Mermaid({ source }: { readonly source: string }) {
	const theme = useContext(ThemeContext);
	const id = useId().replace(/[^a-z\d_-]/giu, "");
	const [drawing, setDrawing] = useState<Drawing | undefined>(() => drawings.get(`${theme}:${source}`));
	const previousSourceRef = useRef(source);
	useEffect(() => {
		if (previousSourceRef.current !== source) {
			for (const [key, value] of drawings) {
				if (value.source === previousSourceRef.current) {
					drawings.delete(key);
				}
			}
			previousSourceRef.current = source;
		}
		const cached = drawings.get(`${theme}:${source}`);
		if (cached) {
			setDrawing(cached);
			return;
		}
		let current = true;
		async function draw() {
			try {
				const { default: mermaid } = await import("mermaid");
				function token(name: string) {
					return name === "--sans" ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : mermaidColor(name);
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
						lineColor: token("--muted-foreground"),
						primaryBorderColor: token("--border"),
						primaryColor: token("--surface"),
						primaryTextColor: token("--text"),
						textColor: token("--text"),
					},
				});
				const { svg } = await mermaid.render(`document-diagram-${id}`, source);
				if (current) {
					setDrawing(retainDrawing(theme, source, svg));
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
	const svgSource = shown && "svg" in shown ? shown.svg : undefined;
	const svgRef = useCallback(
		(element: HTMLDivElement | null) => {
			if (element && svgSource) {
				const svg = new DOMParser().parseFromString(svgSource, "text/html").body.firstElementChild;
				if (svg) {
					element.replaceChildren(document.importNode(svg, true));
				}
			}
		},
		[svgSource],
	);
	return createElement(
		"figure",
		{ className: "diagram", "data-error": shown && "error" in shown ? shown.error : undefined, "data-react-diagram": "", "data-state": state },
		shown && "svg" in shown
			? createElement("div", {
					className: "diagram-svg",
					ref: svgRef,
				})
			: null,
		createElement("pre", { className: "diagram-source", hidden: !(shown && "error" in shown) }, source),
		createElement(
			"span",
			{ "data-visual-tools": "" },
			createElement("button", { "data-inspect-diagram": "", disabled: state !== "drawn", type: "button" }, "Inspect diagram"),
		),
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

function retainDrawing(theme: string, source: string, svg: string) {
	const next = { source, svg };
	drawings.set(`${theme}:${source}`, next);
	const oldest = drawings.keys().next().value;
	if (drawings.size > MAX_DRAWINGS && oldest !== undefined) {
		drawings.delete(oldest);
	}
	return next;
}
