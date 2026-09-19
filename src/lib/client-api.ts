type RequestOptions = { method?: string; body?: unknown; rawBody?: string; idempotencyKey?: string };

let refreshRequest: Promise<Response> | null = null;

export async function apiRequest<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? (options.body !== undefined || options.rawBody !== undefined ? "POST" : "GET");
  const headers: Record<string, string> = {};
  if (options.rawBody !== undefined) headers["Content-Type"] = "application/x-ofx";
  else if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-Idempotency-Key"] = options.idempotencyKey ?? crypto.randomUUID();
  const init: RequestInit = { method, headers, body: options.rawBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined) };
  const send = () => fetch(url, init);
  let response: Response;
  try {
    response = await send();
    if (response.status === 401 && !url.startsWith("/api/auth/")) {
      refreshRequest ??= fetch("/api/auth/refresh", { method: "POST" }).finally(() => { refreshRequest = null; });
      const refreshed = await refreshRequest;
      if (refreshed.ok) response = await send();
    }
  } catch {
    throw new Error("Não foi possível conectar. Verifique sua conexão e tente novamente.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: "Confira os campos e tente novamente.",
      401: "Sua sessão expirou. Entre novamente para continuar.",
      403: "Seu perfil não tem permissão para esta ação.",
      404: "O registro não foi encontrado. Atualize a página.",
      409: "Este registro já existe ou foi alterado. Atualize a página e confira os dados.",
      413: "O arquivo excede o tamanho permitido.",
      422: "Não foi possível concluir. Confira os valores e os registros selecionados.",
    };
    const knownErrors: Record<string, string> = {
      "Measurements exceed contract amount": "As medições ultrapassam o valor total do contrato.",
      "Receipt exceeds open balance": "O recebimento é maior que o saldo do título.",
      "Invalid withholding amounts": "As retenções devem ser menores que o valor total.",
      "Insufficient stock": "Estoque insuficiente para esta saída.",
      "Product unit cannot change after stock movements have been recorded": "A unidade não pode ser alterada após movimentações de estoque.",
      "Required account is missing": "O plano de contas precisa ser configurado antes deste lançamento.",
    };
    throw new Error(knownErrors[data?.error] ?? messages[response.status] ?? "Não foi possível concluir a operação. Tente novamente.");
  }
  return data as T;
}
