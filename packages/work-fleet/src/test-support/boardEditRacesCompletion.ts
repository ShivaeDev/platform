import { completionEdit } from "#test/completionEdit.ts";
import { engineScenario } from "#test/engineScenario.ts";

export function boardEditRacesCompletion() {
	return engineScenario("a human Board edit races completion bookkeeping", () => {
		let edit: (() => void) | undefined;
		function applyEdit() {
			edit?.();
			edit = undefined;
		}
		return {
			context: {
				applyEdit,
				get edit() {
					return edit;
				},
				set edit(value: typeof edit) {
					edit = value;
				},
			},
			options: {
				decorateBoard: (board) => completionEdit(board, applyEdit),
			},
		};
	});
}
