import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

export function hostScenarioVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		acceptSubmissions: () => {
			tell("the provider accepts submissions again");
			engine.rejectSubmission = false;
		},
		advanceDiagnosticTime: (milliseconds: number) => {
			if (engine.diagnosticNow === undefined) {
				throw new Error("Configure the diagnostic clock first");
			}
			tell(`advance the diagnostic clock by ${milliseconds} milliseconds`);
			engine.diagnosticNow += milliseconds;
		},
		advanceTime: (milliseconds: number) => {
			tell(`advance the host policy clock by ${milliseconds} milliseconds`);
			engine.now += milliseconds;
		},
		diagnosticTime: () => {
			if (engine.diagnosticNow === undefined) {
				throw new Error("Configure the diagnostic clock first");
			}
			return engine.diagnosticNow;
		},
		hostModel: (model: string) => {
			tell(`the host launch model becomes ${model}`);
			engine.launch.model = model;
		},
	};
}
