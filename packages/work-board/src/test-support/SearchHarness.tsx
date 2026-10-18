import { useState } from "react";
import { SearchDialog } from "#client/react/SearchDialog.tsx";
import { useAppearance } from "#client/react/useAppearance.ts";
import { useSidebar } from "#client/react/useSidebar.ts";
import type { BoardTestApi } from "./react.tsx";

export function SearchHarness({ api }: { readonly api: BoardTestApi }) {
	const appearance = useAppearance();
	const sidebar = useSidebar(appearance);
	const [open, setOpen] = useState(true);
	return <SearchDialog api={api} appearance={appearance} close={() => setOpen(false)} open={open} toggleSidebar={sidebar.toggle} />;
}
