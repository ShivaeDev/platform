import { answerInput, answerPrompt, responseClick } from "./answerDraft.tsx";

export function answerActions(tell: (line: string) => void) {
	return {
		answerInput: (name: string, value?: string) => {
			if (value !== undefined) {
				tell(`the reader answers ${name} with ${JSON.stringify(value)}`);
			}
			return answerInput(name, value);
		},
		answerPrompt: (name: string, value?: string) => {
			if (value !== undefined) {
				tell(`the reader answers prompt ${name} with ${JSON.stringify(value)}`);
			}
			return answerPrompt(name, value);
		},
		responseClick: (id: string) => {
			tell(`the reader clicks response ${id}`);
			responseClick(id);
		},
	};
}
