import type * as Atom from "effect/reactivity/Atom";
import { Header } from "#client/react/Header.tsx";
import { emptyMainLocation } from "#client/react/mainLocation.ts";
import { UpdatesToggle } from "#client/react/UpdatesToggle.tsx";
import { useAppearance } from "#client/react/useAppearance.ts";
import { useSidebar } from "#client/react/useSidebar.ts";

export function HeaderHarness({ count, paused }: { readonly count: number | null; readonly paused?: Atom.Writable<boolean> | undefined }) {
	const appearance = useAppearance();
	const sidebar = useSidebar(appearance);
	return (
		<Header
			appearance={appearance}
			count={count}
			live={null}
			main={emptyMainLocation}
			openSearch={() => undefined}
			sidebar={sidebar}
			status=""
			updates={paused ? <UpdatesToggle client={{ updates: { paused } }} /> : null}
		/>
	);
}
