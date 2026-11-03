import type { Schema } from "effect";

export interface SubjectColumn<TPayload extends Schema.Top> {
	readonly field: Extract<keyof TPayload["Type"], string>;
	readonly label: string;
}

export interface QueueDisplay {
	readonly label?: string;
	readonly name: string;
	readonly subject?: readonly { readonly field: string; readonly label: string }[];
}
