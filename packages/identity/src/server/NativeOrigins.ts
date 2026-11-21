import { Schema } from "effect";

export const NativeOrigins = Schema.Array(
	Schema.String.check(
		Schema.makeFilter((origin) => {
			if (!URL.canParse(origin)) {
				return false;
			}
			const url = new URL(origin);
			const authority = url.origin === "null" ? `${url.protocol}//${url.host}` : url.origin;
			return url.host !== "" && !origin.includes("*") && authority === origin;
		}),
	),
).pipe(Schema.brand("NativeOrigins"));

export type NativeOrigins = typeof NativeOrigins.Type;
