const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { createApp } = require("../src/server/createApp");

test("health endpoint returns ok", async () => {
  const sessionManager = {
    createSession() {
      throw new Error("not used");
    },
    getSession() {
      throw new Error("not used");
    },
    presentSession() {
      throw new Error("not used");
    },
    startRound() {
      throw new Error("not used");
    },
    applyAction() {
      throw new Error("not used");
    }
  };

  const app = createApp({ sessionManager });
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { ok: true });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
