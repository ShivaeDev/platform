export type Selector =
	| { readonly kind: "anything" }
	| { readonly kind: "anyOf"; readonly members: readonly Selector[] }
	| { readonly kind: "except"; readonly base: Selector; readonly excluded: readonly Selector[] }
	| { readonly kind: "files"; readonly paths: readonly string[] }
	| { readonly kind: "folders"; readonly paths: readonly string[] }
	| { readonly kind: "modules"; readonly names: readonly string[] }
	| { readonly kind: "packages"; readonly names: readonly string[] }
	| { readonly kind: "scopes"; readonly names: readonly string[] }
	| { readonly kind: "workspace" };

export interface Target {
	readonly except: (...excluded: readonly Target[]) => Target;
	readonly selector: Selector;
}

export interface External {
	readonly external: string;
}

export type ExampleStep = string | External;

export type Chain = readonly [string, ExampleStep, ...ExampleStep[]];

export interface Examples {
	readonly illegal: Chain;
	readonly legal: Chain;
}

export type Prohibition =
	| { readonly kind: "import"; readonly to: Selector }
	| { readonly kind: "reach"; readonly to: Selector }
	| { readonly kind: "vocabulary"; readonly subjects: readonly string[]; readonly unit: Selector };

export interface Fence {
	readonly _tag: "Fence";
	readonly examples: Examples;
	readonly from: Selector;
	readonly name: string;
	readonly prohibition: Prohibition;
	readonly rationale: string;
}
