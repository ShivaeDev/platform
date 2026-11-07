import { Option } from "effect";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import type { SessionModuleApi } from "#test-support/sessionModule.tsx";

export function SessionModuleScreen({ api }: { readonly api: SessionModuleApi }) {
	const result = useQuery(api.read.query());
	return <output data-pending={result.pending}>{Option.getOrElse(result.data, () => "Loading")}</output>;
}
