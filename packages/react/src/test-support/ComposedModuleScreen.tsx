import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { useQuery } from "#client/resultState.ts";
import type { composedModule } from "./composedModule.ts";

export function ComposedModuleScreen({ module }: { readonly module: ReturnType<typeof composedModule> }) {
	const result = useQuery(module.api.read.query());
	const window = useAtomValue(module.api[LiveConnection].coalesceWindow);
	return (
		<output data-pending={result.pending}>
			{Option.getOrElse(result.data, () => "Loading")} ({String(window)})
		</output>
	);
}
