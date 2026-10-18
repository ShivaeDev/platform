import { useEffect, useState } from "react";

export function useOpened(opening: Promise<void> | undefined) {
	const [opened, setOpened] = useState(opening === undefined);
	useEffect(() => {
		void opening?.then(() => setOpened(true));
	}, [opening]);
	return opened;
}
