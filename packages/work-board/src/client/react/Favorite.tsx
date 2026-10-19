import { Pin, PinOff } from "lucide-react";
import { useContext } from "react";
import { Button } from "#client/react/components/ui/button.tsx";
import { LibraryContext } from "#client/react/LibraryContext.ts";
import { shellIds } from "./shellIds.ts";
export function Favorite({ file, title }: { readonly file: string; readonly title: string }) {
	const library = useContext(LibraryContext);
	const pinned = library.favorites.some((item) => item.file === file);
	return (
		<Button
			id={shellIds.favoriteToggle}
			onClick={() => library.toggle(file, document.getElementById("doc")?.querySelector("h1")?.textContent?.trim() || title)}
			size="sm"
			type="button"
			variant="outline"
		>
			{pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
			{pinned ? "Unpin" : "Pin"}
		</Button>
	);
}
