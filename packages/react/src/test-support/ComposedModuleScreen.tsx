import { Option } from "effect";
import { useQuery } from "#client/resultState.ts";
import type { composedModule } from "#test/composedModule.ts";

export function ComposedModuleScreen({ module }: { readonly module: ReturnType<typeof composedModule> }) {
	const result = useQuery(module.api.read.query());
	return <output data-pending={result.pending}>{Option.getOrElse(result.data, () => "Loading")}</output>;
}
