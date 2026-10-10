import { Schema } from "effect";
export interface Versioned<A> {
	readonly value: A;
	readonly version: number;
}

export interface AdmissionLimits {
	readonly maxBacklog?: number;
	readonly maxExecuting?: number;
	readonly quota?: { readonly observedAt: number; readonly available: number };
	readonly recheckOwnership?: boolean;
}

export interface StoredRow {
	readonly value: string;
	readonly version: number;
}

export const ForeignReservation = Schema.Struct({
	backlog: Schema.Boolean,
	executing: Schema.Boolean,
	owner: Schema.String,
	paths: Schema.Array(Schema.String),
});
export type ForeignReservation = typeof ForeignReservation.Type;
