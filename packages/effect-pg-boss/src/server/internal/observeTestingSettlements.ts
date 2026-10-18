import type { PgBoss } from "pg-boss";

export function observeTestingSettlements(client: PgBoss, changed: () => void) {
	const observers = new Map<string, () => void>();
	return {
		close() {
			for (const close of observers.values()) {
				close();
			}
			observers.clear();
		},
		watch(name: string) {
			if (observers.has(name)) {
				return;
			}
			const spy = client.getSpy(name);
			let open = true;
			async function observe() {
				while (true) {
					await Promise.race([spy.waitForJob(() => true, "completed"), spy.waitForJob(() => true, "failed")]);
					if (!open) {
						return;
					}
					// This controller owns the spy; clear history and the losing wait before rearming both outcomes.
					spy.clear();
					changed();
				}
			}
			observers.set(name, () => {
				open = false;
				spy.clear();
			});
			void observe().catch((error: unknown) => client.emit("error", error instanceof Error ? error : new Error(String(error))));
		},
	};
}
