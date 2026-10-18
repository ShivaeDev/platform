import {
	type ResumeOptions as ContractOptions,
	type ResumeSource as ContractSource,
	type ResumeWindow as ContractWindow,
	resumeSignal as contractResumeSignal,
} from "@shivaedev/effect-contract/resume.ts";

export type ResumeSource = ContractSource;
export type ResumeWindow = ContractWindow;
export type ResumeOptions = ContractOptions;
export function resumeSignal(options: ResumeOptions) {
	return contractResumeSignal(options);
}
