import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { Admin } from "#modules/notes/admin/pages.ts";
import { Statistics } from "#modules/notes/admin/Statistics.ts";

export const adminRegistration = registerAdmin(Admin, {
	"note-statistics": Statistics,
});
