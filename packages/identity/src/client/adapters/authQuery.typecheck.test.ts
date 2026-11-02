import type { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { authQuery } from "./authQuery.ts";

const consent = authQuery((id: string, _signal) =>
	Promise.resolve(
		id === "allowed"
			? { data: { id }, error: null }
			: { data: null, error: { code: "REFUSED" as const, status: HttpStatus.fromLiteral("Forbidden") } },
	),
);
export const result: Effect.Effect<{ readonly id: string } | null, { readonly code: "REFUSED"; readonly status: number } | AuthUnavailable> =
	consent("allowed");
// @ts-expect-error Auth query inputs retain their declared type.
consent(123);
