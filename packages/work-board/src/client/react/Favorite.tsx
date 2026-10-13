import { useContext } from "react";
import { LibraryContext } from "./readingLibrary.ts";
import { shellIds } from "./shellIds.ts";
export function Favorite({ file, title }: { readonly file: string; readonly title: string }) {
	const library = useContext(LibraryContext);
	const saved = library.favorites.some((item) => item.file === file);
	return (
		<button
			aria-pressed={saved}
			id={shellIds.favoriteToggle}
			onClick={() => library.toggle(file, document.getElementById("doc")?.querySelector("h1")?.textContent?.trim() || title)}
			type="button"
		>
			{saved ? "Remove favorite" : "Save favorite"}
		</button>
	);
}
