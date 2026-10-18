import { type BoardEngine, served } from "./storyEngine.ts";

export function workspaceAccess(engine: BoardEngine, tell: (line: string) => void) {
	return {
		get board() {
			return served(engine).board;
		},
		get client() {
			return served(engine).client;
		},
		notes: {
			...engine.notes,
			write: (path: string, source: string) => {
				tell(`an outside editor writes ${path}`);
				engine.notes.write(path, source);
			},
		},
		register: async () => {
			tell("the reader registers the questionnaire against its reviewed source");
			const client = served(engine).client;
			const preview = await client.run(client.responses.question.run({ item: "investigation.choices", request: "direction" }));
			return client.mutate(
				client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision }),
			);
		},
	};
}
