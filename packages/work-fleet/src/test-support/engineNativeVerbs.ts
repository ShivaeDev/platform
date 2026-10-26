import type { EngineStory } from "#test/engineState.ts";

export function engineNativeVerbs(state: EngineStory, tell: (line: string) => void) {
	function server() {
		if (state.recovery.native === undefined) {
			throw new Error("No native Codex provider is configured");
		}
		return state.recovery.native;
	}
	return {
		addProviderItem: () => {
			tell("the provider reports a new command item");
			server().addItem();
		},
		changeProviderItemStatus: () => {
			tell("the provider changes its command status");
			server().changeStatus();
		},
		emitProviderEvent: () => {
			tell("the provider streams a live event on the worker thread");
			server().emit();
		},
		hideNativeTurn: (id: string) => {
			if (!server().states.has(id)) {
				throw new Error(`No ${id} turn is available to hide`);
			}
			tell(`the provider hides ${id}`);
			server().hidden.add(id);
		},
		nativeRequests: () => [...server().requests],
		setNativeTurnState: (id: string, value: string) => {
			tell(`the provider reports ${id} as ${value}`);
			server().states.set(id, value);
		},
		showNativeTurn: (id: string) => {
			if (!server().hidden.has(id)) {
				throw new Error(`No ${id} turn is hidden`);
			}
			tell(`the provider restores ${id}`);
			server().hidden.delete(id);
		},
	};
}
