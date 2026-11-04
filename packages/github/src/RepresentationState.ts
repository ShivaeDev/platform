import type { Effect } from "effect";
import type { requests } from "#requests.ts";

export interface RepresentationState {
	readonly apiUrl: string;
	readonly request: Effect.Success<ReturnType<typeof requests>>;
	readonly resource: (path: string) => string;
	readonly responseByteLimit: number;
}
