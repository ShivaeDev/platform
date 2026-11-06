import { Schema } from "effect";
import type { QueryUpdate } from "@shivaedev/contract/queryUpdate.ts";
import { Order } from "./contract.ts";

export function hintWord(hint: QueryUpdate) {
	return hint._tag === "Result" ? `result ${Schema.decodeUnknownSync(Order)(hint.value).name}` : hint._tag.toLowerCase();
}

export function answerWord(result: { readonly _tag: "Success" | "Failure"; readonly failure?: unknown }) {
	if (result._tag === "Success") {
		return "saved";
	}
	const failure = result.failure;
	return `rejected as ${typeof failure === "object" && failure !== null && "_tag" in failure ? String(failure._tag) : String(failure)}`;
}
