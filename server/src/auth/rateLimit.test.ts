import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { clientIp, ipAndEmailKey, ipKey, rateLimit } from "./rateLimit.js";

// Each test uses a distinct key prefix so the module-level bucket map, which is
// shared by design, cannot leak state between tests.
let counter = 0;
beforeEach(() => {
  counter += 1;
});

function appWithLimit(limit: number, windowMs = 60_000) {
  const app = new Hono();
  const prefix = `t${counter}`;
  app.use("*", rateLimit({ limit, windowMs, key: ipKey(prefix) }));
  app.get("/", (c) => c.text("ok"));
  app.onError((err, c) =>
    err instanceof HTTPException
      ? c.json({ message: err.message }, err.status)
      : c.json({ message: "boom" }, 500),
  );
  return app;
}

const from = (ip: string) => ({ headers: { "X-Real-Client-IP": ip } });

describe("rateLimit", () => {
  it("allows requests up to the limit and blocks the next one", async () => {
    const app = appWithLimit(3);

    for (let i = 1; i <= 3; i += 1) {
      const res = await app.request("/", from("1.1.1.1"));
      assert.equal(res.status, 200, `request ${i} should pass`);
    }
    assert.equal((await app.request("/", from("1.1.1.1"))).status, 429);
  });

  it("sets Retry-After when blocking", async () => {
    const app = appWithLimit(1);
    await app.request("/", from("2.2.2.2"));

    const blocked = await app.request("/", from("2.2.2.2"));
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
  });

  it("buckets independently per client", async () => {
    const app = appWithLimit(1);
    await app.request("/", from("3.3.3.3"));

    // A different client must be unaffected by the first one's budget.
    assert.equal((await app.request("/", from("4.4.4.4"))).status, 200);
    assert.equal((await app.request("/", from("3.3.3.3"))).status, 429);
  });

  it("starts a fresh budget once the window elapses", async () => {
    const app = appWithLimit(1, 40);
    assert.equal((await app.request("/", from("5.5.5.5"))).status, 200);
    assert.equal((await app.request("/", from("5.5.5.5"))).status, 429);

    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal((await app.request("/", from("5.5.5.5"))).status, 200);
  });

  it("blocks before the handler runs, so it cannot leak whether a request would have succeeded", async () => {
    let handlerCalls = 0;
    const app = new Hono();
    app.use(
      "*",
      rateLimit({ limit: 1, windowMs: 60_000, key: ipKey(`oracle${counter}`) }),
    );
    app.get("/", (c) => {
      handlerCalls += 1;
      return c.text("ok");
    });
    app.onError((err, c) =>
      err instanceof HTTPException
        ? c.json({ message: err.message }, err.status)
        : c.json({ message: "boom" }, 500),
    );

    await app.request("/", from("6.6.6.6"));
    await app.request("/", from("6.6.6.6"));

    assert.equal(
      handlerCalls,
      1,
      "the blocked request must not reach the handler",
    );
  });
});

describe("clientIp", () => {
  async function ipSeenBy(init: RequestInit) {
    const app = new Hono();
    let seen = "";
    app.get("/", (c) => {
      seen = clientIp(c);
      return c.text("ok");
    });
    await app.request("/", init);
    return seen;
  }

  it("prefers X-Real-Client-IP, which the proxy overwrites", async () => {
    const seen = await ipSeenBy({
      headers: {
        "X-Real-Client-IP": "9.9.9.9",
        "X-Forwarded-For": "1.2.3.4, 5.6.7.8",
      },
    });
    assert.equal(seen, "9.9.9.9");
  });

  // Caddy APPENDS to X-Forwarded-For, so a client-supplied value survives as the
  // LEFTMOST entry. Taking the leftmost would make the limiter trivially
  // bypassable by sending a random XFF header on every request.
  it("takes the rightmost X-Forwarded-For hop, not the spoofable leftmost one", async () => {
    const seen = await ipSeenBy({
      headers: { "X-Forwarded-For": "666.evil.spoof, 10.0.0.1, 203.0.113.9" },
    });
    assert.equal(seen, "203.0.113.9");
  });

  it("handles a single-entry X-Forwarded-For", async () => {
    const seen = await ipSeenBy({
      headers: { "X-Forwarded-For": "203.0.113.7" },
    });
    assert.equal(seen, "203.0.113.7");
  });
});

describe("ipAndEmailKey", () => {
  async function keyFor(init: RequestInit) {
    const app = new Hono();
    let key = "";
    app.post("/", async (c) => {
      key = await ipAndEmailKey(c);
      return c.text("ok");
    });
    await app.request("/", init);
    return key;
  }

  const post = (body: unknown, ip = "1.1.1.1") => ({
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Real-Client-IP": ip },
    body: JSON.stringify(body),
  });

  it("separates buckets per account so one attacker cannot lock out another user", async () => {
    const a = await keyFor(post({ email: "victim@example.com" }));
    const b = await keyFor(post({ email: "other@example.com" }));

    assert.notEqual(a, b);
  });

  it("normalizes the email so casing and padding cannot split the bucket", async () => {
    const plain = await keyFor(post({ email: "user@example.com" }));
    const shouty = await keyFor(post({ email: "  USER@Example.COM  " }));

    assert.equal(plain, shouty);
  });

  it("still buckets by IP when the body has no email or is not JSON", async () => {
    const noEmail = await keyFor(post({}, "7.7.7.7"));
    const notJson = await keyFor({
      method: "POST",
      headers: { "X-Real-Client-IP": "7.7.7.7" },
      body: "not json at all",
    });

    assert.ok(noEmail.includes("7.7.7.7"));
    assert.equal(noEmail, notJson);
  });

  // The middleware reads the body to build the key; Hono caches the parsed body
  // so the route handler must still be able to read it.
  it("leaves the request body readable by the handler", async () => {
    const app = new Hono();
    let handlerSaw: unknown = null;
    app.use(
      "*",
      rateLimit({ limit: 10, windowMs: 60_000, key: ipAndEmailKey }),
    );
    app.post("/", async (c) => {
      handlerSaw = await c.req.json();
      return c.text("ok");
    });

    const res = await app.request(
      "/",
      post({ email: "a@b.c", password: "pw" }),
    );

    assert.equal(res.status, 200);
    assert.deepEqual(handlerSaw, { email: "a@b.c", password: "pw" });
  });
});
