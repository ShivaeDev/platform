import { useState } from "react";
import { Modal } from "#client/react/Modal.tsx";
import { SearchPalette } from "#client/react/SearchPalette.tsx";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { shellIds } from "#client/react/shellIds.ts";
import type { AppearanceControls } from "#client/react/useAppearance.ts";

export function SearchDialog({
	api,
	open,
	close,
	appearance,
	toggleSidebar,
	returnFocus,
}: {
	readonly api: ShellApi;
	readonly open: boolean;
	readonly close: () => void;
	readonly appearance: AppearanceControls;
	readonly toggleSidebar: () => void;
	readonly returnFocus?: HTMLElement | undefined;
}) {
	const [input, setInput] = useState("");
	return (
		<Modal
			className="command-palette"
			close={close}
			focus="search-query"
			id={shellIds.searchDialog}
			open={open}
			returnFocus={returnFocus}
			title="search-title"
		>
			<div className="search-header">
				<h2 id={shellIds.searchTitle}>Find work</h2>
				<button aria-label="Close search" id={shellIds.searchClose} onClick={() => close()} type="button">
					Close
				</button>
			</div>
			{open ? (
				<SearchPalette api={api} appearance={appearance} close={close} input={input} setInput={setInput} toggleSidebar={toggleSidebar} />
			) : null}
		</Modal>
	);
}
