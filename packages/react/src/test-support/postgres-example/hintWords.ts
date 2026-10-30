import type { LiveHint } from "@shivaedev/contract/live.ts";

export function hintWord(hint: LiveHint) {
	if (hint._tag === "Resync") {
		return "resync";
	}
	return `changed ${hint.keys.map((key) => (key._tag === "Item" ? `${key.collection} ${key.id}` : key.collection)).join(", ")}`;
}

export function answerWord(result: { readonly _tag: "Success" | "Failure"; readonly failure?: unknown }) {
	if (result._tag === "Success") {
		return "saved";
	}
	const failure = result.failure;
	return `rejected as ${typeof failure === "object" && failure !== null && "_tag" in failure ? String(failure._tag) : String(failure)}`;
}
