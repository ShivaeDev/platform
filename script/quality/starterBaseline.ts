import { Effect } from "effect";
import { decodeBaseline, encodeBaseline } from "@shivaedev/quality/baseline/format.ts";
import { defineRule } from "@shivaedev/quality/rule.ts";

export const starterBaseline = defineRule({
	check: Effect.fn("StarterBaseline.check")(function* ({ readText }) {
		const root = yield* Effect.promise(() => readText("quality-baseline.jsonl"));
		const starter = yield* Effect.promise(() => readText("examples/starter/quality-baseline.jsonl"));
		const parent = yield* Effect.promise(() => decodeBaseline(root));
		const child = yield* Effect.promise(() => decodeBaseline(starter));
		if (parent._tag === "Invalid" || child._tag === "Invalid") {
			return [{ file: "quality-baseline.jsonl", message: "Repair the invalid baseline before comparing starter debt." }];
		}
		const prefix = "examples/starter/";
		const mirrored = parent.value
			.filter((entry) => entry.file.startsWith(prefix))
			.map((entry) => ({ ...entry, file: entry.file.slice(prefix.length) }));
		return encodeBaseline(mirrored) === encodeBaseline(child.value)
			? []
			: [
					{
						file: "quality-baseline.jsonl",
						message: "Keep starter entries equal to examples/starter/quality-baseline.jsonl, with the examples/starter/ prefix.",
					},
				];
	}),
	description: "Keep the root and standalone starter gates on the same recorded debt.",
	id: "baseline/starter-mirror",
	registrable: false,
});
