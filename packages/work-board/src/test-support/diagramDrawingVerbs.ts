import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { diagramPalette } from "./diagramPalette.ts";
import { readingSettles } from "./readingSettle.ts";
import { screenAct } from "./screenAct.ts";
import type { DiagramDrawing } from "./screenDiagrams.ts";
import type { ScreenEngine } from "./screenEngine.ts";

type Theme = "light" | "dark";

const DRAWING_LIMIT_MS = 10_000;
const answered = new WeakSet<DiagramDrawing>();

function diagramName(source: string) {
	return source.trim().replace(/^graph TD; /u, "");
}

function themeOf(dark: boolean | string | null): Theme {
	return dark === true || dark === "true" ? "dark" : "light";
}

export function diagramDrawingVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function waiting(diagram: string, theme: Theme) {
		return (engine.drawings ?? []).find(
			(drawing) => !answered.has(drawing) && diagramName(drawing.source) === diagram && themeOf(drawing.dark) === theme,
		);
	}
	function answer(diagram: string, theme: Theme, error?: string) {
		return Effect.gen(function* () {
			tell(error ? `Mermaid fails to draw ${diagram} in ${theme}: ${error}` : `Mermaid finishes drawing ${diagram} in ${theme}`);
			const drawing = waiting(diagram, theme);
			if (!drawing) {
				return yield* Effect.die(new Error(`Mermaid was not asked to draw ${diagram} in ${theme}`));
			}
			answered.add(drawing);
			yield* Effect.promise(() => act(async () => drawing.finish(error)));
			yield* readingSettles(engine, tell);
		});
	}
	return {
		diagramFigures: () =>
			Effect.sync(() => {
				tell("the reader looks at the diagrams on the page");
				return [...document.querySelectorAll<HTMLElement>("figure.diagram")].map((figure) => {
					const svg = figure.querySelector("svg");
					const source = figure.querySelector<HTMLElement>(".diagram-source");
					const error = figure.querySelector("[data-diagram-error]")?.textContent;
					return {
						drawing: svg
							? `${diagramName(decodeURIComponent(svg.getAttribute("data-source") ?? ""))} in ${themeOf(svg.getAttribute("data-dark"))}`
							: "none",
						source: !source || source.hidden ? "hidden" : diagramName(source.textContent ?? ""),
						state: figure.dataset.state,
						...(error ? { error } : {}),
					};
				});
			}),
		drawingRequests: () =>
			Effect.sync(() => {
				tell("the reader reads what Mermaid was asked to draw");
				return (engine.drawings ?? []).map((drawing) => `${diagramName(drawing.source)} in ${themeOf(drawing.dark)}`);
			}),
		mermaidColours: (diagram: string, theme: Theme) =>
			Effect.sync(() => {
				tell(`the reader checks the colours Mermaid was given to draw ${diagram} in ${theme}`);
				const drawing = (engine.drawings ?? []).find((request) => diagramName(request.source) === diagram && themeOf(request.dark) === theme);
				if (!drawing) {
					throw new Error(`Mermaid was not asked to draw ${diagram} in ${theme}`);
				}
				const { amber, effects, offBoard, unreadable } = diagramPalette(drawing);
				return { amber, effects, offBoard, unreadable };
			}),
		mermaidDraws: (diagram: string, theme: Theme = "light") => answer(diagram, theme),
		mermaidFails: (diagram: string, error: string, theme: Theme = "light") => answer(diagram, theme, error),
		// Mermaid loads and is asked to draw after the page has settled, so the story waits for the request to reach the gated engine.
		mermaidIsAskedToDraw: (diagram: string, theme: Theme = "light") =>
			Effect.sync(() => tell(`wait until Mermaid is asked to draw ${diagram} in ${theme}`)).pipe(
				Effect.andThen(
					screenDriver({
						act: screenAct,
						pending: () => waiting(diagram, theme) === undefined,
						root: () => document.body,
						tell: () => undefined,
					}).settle({ timeoutMs: DRAWING_LIMIT_MS }),
				),
			),
	};
}
