import { expect } from "@effect/vitest";
import { fromRef } from "#refs.ts";
import { expenses, initial } from "#test/expense.ts";

expenses.it(
	"a delayed save and refresh preserve newer quantity and date edits until explicit revert",
	[expenses.delayed()],
	function* ({ form, submit, result, waitForSave, finishSave, dirty, read }) {
		const date = fromRef(form.field("date"));
		read(date);
		form.change("quantity", "2");
		submit();
		yield* waitForSave();
		form.change("quantity", "3.50");
		form.change("date", "2026-09-18");
		yield* finishSave();
		expect((yield* result()).quantity).toBe(2);
		form.receive({ ...initial, payee: "Server payee", quantity: "2" });
		expect(form.field("payee").value).toBe("Server payee");
		expect(form.field("quantity").value).toBe("3.50");
		expect(form.field("date").value).toBe("2026-09-18");
		expect(dirty()).toBe(true);
		form.revert();
		expect(form.field("payee").value).toBe("Server payee");
		expect(form.field("quantity").value).toBe("2");
		expect(form.field("date").value).toBeUndefined();
		expect(read(date)).toBeUndefined();
		expect(Object.hasOwn(form.values.value, "date")).toBe(false);
		expect(dirty()).toBe(false);
	},
);

expenses.it(
	"a refresh during an unrelated edit submits the refreshed subtotal, not the stale one",
	[expenses.withValues({ ...initial, subtotal: "300" })],
	function* ({ form, submit, result }) {
		form.change("payee", "Harbor Hotel");
		form.receive({ ...initial, subtotal: "350" });
		expect(form.field("payee").value).toBe("Harbor Hotel");
		expect(form.field("subtotal").value).toBe("350");
		submit();
		expect(yield* result()).toMatchObject({ payee: "Harbor Hotel", subtotal: 350 });
	},
);
