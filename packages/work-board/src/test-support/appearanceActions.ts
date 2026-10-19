import { runInNewContext } from "node:vm";

export function appearanceActions(tell: (line: string) => void) {
	return {
		initializeAppearance: (script: string) => {
			tell("the shell initializes appearance before React starts");
			runInNewContext(script, {
				document,
				get localStorage() {
					return window.localStorage;
				},
				matchMedia: (query: string) => matchMedia(query),
			});
		},
	};
}
