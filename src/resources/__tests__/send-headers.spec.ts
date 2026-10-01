import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpClient } from "../../core/http-client.js";
import { Emails } from "../emails.js";

describe("Emails send transport", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let emails: Emails;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => JSON.stringify({ id: "eml_1", status: "queued" }),
    });
    emails = new Emails(new HttpClient("cm_live_teste123", { fetch: mockFetch }));
  });

  const lastRequest = (): { headers: Record<string, string>; body: Record<string, unknown> } => {
    const init = mockFetch.mock.calls[0]?.[1] as {
      headers: Record<string, string>;
      body: string;
    };
    return { headers: init.headers, body: JSON.parse(init.body) as Record<string, unknown> };
  };

  const basePayload = {
    from: "contato@empresa.com.br",
    to: "cliente@gmail.com",
    subject: "Teste",
    html: "<p>Olá</p>",
  };

  it("envia a chave de idempotência como header, nunca no corpo", async () => {
    await emails.send({ ...basePayload, idempotencyKey: "pedido-123" });

    const { headers, body } = lastRequest();
    expect(headers["x-idempotency-key"]).toBe("pedido-123");
    expect(body).not.toHaveProperty("idempotencyKey");
  });

  it("envia o modo sandbox como header, nunca no corpo", async () => {
    await emails.send({ ...basePayload, isSandbox: true });

    const { headers, body } = lastRequest();
    expect(headers["x-coffeemail-sandbox"]).toBe("true");
    expect(body).not.toHaveProperty("isSandbox");
  });

  it("omite os headers quando os campos não são informados", async () => {
    await emails.send(basePayload);

    const { headers } = lastRequest();
    expect(headers).not.toHaveProperty("x-idempotency-key");
    expect(headers).not.toHaveProperty("x-coffeemail-sandbox");
  });

  it("não envia o header de sandbox quando explicitamente desligado", async () => {
    await emails.send({ ...basePayload, isSandbox: false });

    const { headers, body } = lastRequest();
    expect(headers).not.toHaveProperty("x-coffeemail-sandbox");
    expect(body).not.toHaveProperty("isSandbox");
  });
});
