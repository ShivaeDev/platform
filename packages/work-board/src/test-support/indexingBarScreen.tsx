import * as Atom from "effect/reactivity/Atom";
import { IndexingBar } from "#client/react/IndexingProgress.tsx";
import { componentScreen } from "./screenTraits.ts";

export function indexingBarScreen(progress?: { readonly read: number; readonly total?: number }) {
	return componentScreen(<IndexingBar indexing={Atom.make(progress === undefined ? undefined : { _tag: "Indexing" as const, ...progress })} />);
}
