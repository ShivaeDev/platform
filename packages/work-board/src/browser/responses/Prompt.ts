export interface Prompt {
	readonly id: string;
	readonly mode: "one" | "many" | "text";
	readonly options: readonly { readonly id: string; readonly source: string }[];
	readonly source: string;
}
