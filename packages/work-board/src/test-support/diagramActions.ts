import { act } from "react";
import { diagramPalette } from "./diagramPalette.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function diagramActions(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		diagramPalette: (index: number) => {
			tell(`the reader checks the colours Mermaid was given for drawing ${index}`);
			const drawing = engine.drawings?.[index];
			if (!drawing) {
				throw new Error(`No pending diagram drawing ${index}`);
			}
			return diagramPalette(drawing);
		},
		drawings: () => {
			tell("the reader checks the pending diagram drawings");
			return (engine.drawings ?? []).map(({ source, dark }) => ({ dark, source }));
		},
		finishDiagram: async (index: number, error?: string) => {
			tell(`Mermaid ${error ? "rejects" : "finishes"} drawing ${index}`);
			const drawing = engine.drawings?.[index];
			if (!drawing) {
				throw new Error(`No pending diagram drawing ${index}`);
			}
			await act(async () => drawing.finish(error));
		},
	};
}
