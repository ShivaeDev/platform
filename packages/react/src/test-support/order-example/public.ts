import { Order } from "./contract.ts";
import type { OrderRow } from "./repository.ts";

export function publicOrder(row: OrderRow) {
	return new Order({ id: row.id, name: row.name, quantity: row.quantity });
}
