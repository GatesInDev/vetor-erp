import { HttpError } from "@/lib/auth";

export async function readReportTemplateBody(request: Request): Promise<unknown> {
  const maximumBytes = 2 * 1024 * 1024;
  if (Number(request.headers.get("content-length") ?? "0") > maximumBytes) throw new HttpError(413, "Report template request is too large");
  if (!request.body) throw new HttpError(400, "Request body is required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new HttpError(413, "Report template request is too large");
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
