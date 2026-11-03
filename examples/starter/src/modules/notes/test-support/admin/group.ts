import { foundation } from "#admin/foundation.ts";
import { StatisticsPage } from "#modules/notes/admin/pages.ts";

export const adminGroup = foundation.admin.group.merge(StatisticsPage.contract);
