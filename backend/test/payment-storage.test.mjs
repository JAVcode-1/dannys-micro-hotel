import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createServer } from "node:http";
import process from "node:process";
import { test } from "node:test";
import { paymentMediaStore } from "../dist/payment-media.js";

test("the real Storage adapter refuses a public bucket before uploading any proof", async () => {
  let writes = 0;
  const server = createServer((request, response) => {
    if (request.method !== "GET") writes++;
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        id: "payment-proofs",
        name: "payment-proofs",
        public: true,
      }),
    );
  }).listen(0, "127.0.0.1");
  const previousUrl = process.env.SUPABASE_URL;
  const previousSecret = process.env.SUPABASE_SECRET_KEY;
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only_not_a_real_key";
    const store = paymentMediaStore();
    await assert.rejects(
      store.upload(
        "payment-proofs",
        "test.png",
        Buffer.from("test"),
        "image/png",
      ),
      /Private payment storage is unavailable/,
    );
    assert.equal(writes, 0);
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousSecret;
    await new Promise((resolve) => server.close(resolve));
  }
});
