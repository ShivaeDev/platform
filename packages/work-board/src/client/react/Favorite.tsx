import { Star } from "lucide-react";
import { useContext } from "react";
import { Button } from "#client/react/components/ui/button.tsx";
import { LibraryContext } from "#client/react/LibraryContext.ts";
import { shellIds } from "./shellIds.ts";
export function Favorite({ file, title }: { readonly file: string; readonly title: string }) {
	const library = useContext(LibraryContext);
	const saved = library.favorites.some((item) => item.file === file);
	return (
		<Button
			aria-pressed={saved}
			id={shellIds.favoriteToggle}
			onClick={() => library.toggle(file, document.getElementById("doc")?.querySelector("h1")?.textContent?.trim() || title)}
			size="sm"
			type="button"
			variant="outline"
		>
			<Star aria-hidden="true" className={saved ? "fill-current text-primary" : undefined} />
			{saved ? "Remove favorite" : "Save favorite"}
		</Button>
	);
}
