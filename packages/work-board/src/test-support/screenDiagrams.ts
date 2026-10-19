import { Effect } from "effect";
import { act } from "react";
import { mermaidEngine } from "./mermaidEngine.ts";
import { screenStory } from "./screenStory.ts";

export interface DiagramDrawing {
	readonly colors: Readonly<Record<string, unknown>>;
	readonly dark: boolean;
	readonly finish: (error?: string) => void;
	readonly source: string;
}

export function gatedDiagrams() {
	return screenStory.trait("workspace", "Mermaid waits for the drawing engine", function* (engine) {
		engine.drawings = [];
		mermaidEngine.render.mockImplementation((_id?: string, source = "") => {
			const config = mermaidEngine.initialize.mock.lastCall?.[0];
			const dark = config?.themeVariables.darkMode === true;
			return new Promise((resolve, reject) => {
				engine.drawings?.push({
					colors: config?.themeVariables ?? {},
					dark,
					finish: (error) =>
						error ? reject(new Error(error)) : resolve({ svg: `<svg data-source="${encodeURIComponent(source.trim())}" data-dark="${dark}"></svg>` }),
					source,
				});
			});
		});
		yield* Effect.addFinalizer(() =>
			Effect.promise(async () => {
				await act(() =>
					Promise.resolve().then(() => {
						for (const drawing of engine.drawings ?? []) {
							drawing.finish();
						}
					}),
				);
				mermaidEngine.render.mockReset();
				mermaidEngine.render.mockResolvedValue({ svg: '<svg role="img"><text>Question → Response → History</text></svg>' });
			}),
		);
	});
}
