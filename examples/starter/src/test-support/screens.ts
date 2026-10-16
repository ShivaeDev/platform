import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { openNote } from "./openNote.tsx";
import { screenActions } from "./screenActions.ts";

interface Screen {
	editor: Awaited<ReturnType<typeof openNote>> | undefined;
	tell: (line: string) => void;
}

export const screens = storyKit({
	clock: "live",
	create: (): Screen => ({ editor: undefined, tell: () => undefined }),
	inspect: (engine) => ({ text: engine.editor?.view.container.textContent }),
	name: "starter screen",
	stages: ["screen"],
	verbs: (engine, story) => {
		engine.tell = story.tell;
		return {
			editor: () => {
				if (engine.editor === undefined) {
					throw new Error("The editor is not open");
				}
				return engine.editor;
			},
			interact: (run: () => Promise<void>) => Effect.promise(run),
			...screenActions(story.tell),
		};
	},
});

export function editingNote() {
	return screens.trait("screen", "the first note is open in the editor", function* (engine) {
		engine.editor = yield* Effect.promise(() => openNote((line) => engine.tell(line)));
	});
}
