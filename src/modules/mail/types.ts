export type MailConnectionView = {
  id: string;
  username: string;
  host: "imap.gmail.com";
  port: 993;
  folder: string;
  enabled: boolean;
  autoSync: boolean;
  importSince: string;
  revision: number;
  hasPassword: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  syncing: boolean;
};

export type MailAttachmentView = {
  id: string;
  fileName: string;
  mediaType: "application/xml" | "application/pdf";
  sizeBytes: number;
  rentalChargeId: string | null;
  rentalId: string | null;
};

export type MailMessageRow = {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  attachmentCount: number;
  importedAttachmentCount: number;
};

export type MailMessageDetail = MailMessageRow & {
  bodyText: string;
  warnings: string[];
  attachments: MailAttachmentView[];
};

export type MailSyncResult = { imported: number; skipped: number; hasMore: boolean };

export type ImapAttachment = {
  partId: string;
  fileName: string;
  mediaType: "application/xml" | "application/pdf";
  content: Buffer;
};

export type ImapMessage = {
  uid: number;
  messageId: string | null;
  subject: string;
  from: string;
  receivedAt: Date;
  bodyText: string;
  warnings: string[];
  attachments: ImapAttachment[];
};

export type ImapSyncInput = {
  username: string;
  password: string;
  folder: string;
  importSince: Date;
  uidValidity: string | null;
  afterUid: number;
  limit: number;
  deadlineMs: number;
};

export type ImapSyncBatch = {
  uidValidity: string;
  cursorUid: number;
  hasMore: boolean;
  messages: ImapMessage[];
};

export type MailTransport = (input: ImapSyncInput) => Promise<ImapSyncBatch>;
