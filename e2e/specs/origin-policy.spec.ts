import { expect, test } from "@playwright/test";

test("websocket upgrade rejects disallowed origins", async ({ request }) => {
  const apiPort = process.env.E2E_API_PORT ?? "18080";
  const response = await request.get(`http://127.0.0.1:${apiPort}/connect`, {
    headers: {
      Connection: "Upgrade",
      Upgrade: "websocket",
      Origin: "http://malicious.example",
      "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
      "Sec-WebSocket-Version": "13",
    },
  });

  expect(response.status()).toBe(403);
});
