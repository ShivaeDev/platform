import { useEffect, useState } from "react";

export function useMedia(query: string) {
	const [matches, setMatches] = useState(() => matchMedia(query).matches);
	useEffect(() => {
		const media = matchMedia(query);
		function sync() {
			setMatches(media.matches);
		}
		media.addEventListener("change", sync);
		window.addEventListener("resize", sync);
		sync();
		return () => {
			media.removeEventListener("change", sync);
			window.removeEventListener("resize", sync);
		};
	}, [query]);
	return matches;
}
