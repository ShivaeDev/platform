import { createContext } from "react";
import type { noticeStore } from "./noticeStore.ts";

export const NoticeContext = createContext<ReturnType<typeof noticeStore> | undefined>(undefined);
