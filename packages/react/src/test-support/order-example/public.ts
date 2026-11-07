import { Order } from "#test/order-example/contract.ts";
import type { OrderRow } from "#test/order-example/repository.ts";

export function publicOrder(row: OrderRow) {
	return new Order({ id: row.id, name: row.name, quantity: row.quantity });
}
