import "server-only";

import { db } from "@/lib/db";
import { fetchMailboxBatch } from "./imap";
import { readMailConnection, readMailMessage, readMailMessages } from "./operations";
import { synchronizeMailbox } from "./sync";
import type { MailMessageFilters } from "./schema";

export const getMailConnection = (companyId: string) => readMailConnection(db, companyId);
export const getMailMessages = (companyId: string, filters: MailMessageFilters = {}) => readMailMessages(db, companyId, filters);
export const getMailMessage = (companyId: string, id: string) => readMailMessage(db, companyId, id);
export const syncMailbox = (companyId: string, deadlineMs?: number) => synchronizeMailbox(db, companyId, fetchMailboxBatch, deadlineMs);
