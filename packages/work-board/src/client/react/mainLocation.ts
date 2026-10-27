import type { Cause } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";

export interface MainLocation {
	readonly failure?: Cause.Cause<unknown> | undefined;
	readonly file: string;
	readonly projection: string;
	readonly route: string;
	readonly status: number;
	readonly title?: string | undefined;
	readonly view: string;
}

export const NOT_FOUND_PROJECTION = "not-found";

export const emptyMainLocation: MainLocation = { file: "", projection: "document", route: "", status: HttpStatus.fromLiteral("OK"), view: "" };
