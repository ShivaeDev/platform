import { useEffect, useState } from "react";

export function useOpened(opening: Promise<void> | undefined) {
	const [opened, setOpened] = useState(opening === undefined);
	useEffect(() => {
		let active = true;
		void opening?.then(() => {
			if (active) {
				setOpened(true);
			}
		});
		return () => {
			active = false;
		};
	}, [opening]);
	return opened;
}
