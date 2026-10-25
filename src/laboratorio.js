const { once } = require("node:events");
const path = require("node:path");

const { auditRpc } = require("./audit-rpc.js");
const { createRpcServer } = require("./mock-rpc.js");

/** Levanta un servidor efímero, lo audita y garantiza su cierre. */
async function ejecutarEscenario({ mode, reportFile, apiKey = "clave-laboratorio" }) {
  const server = createRpcServer({
    mode,
    apiKey,
    allowedOrigin: "http://localhost:3000"
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  const endpoint = `http://127.0.0.1:${address.port}`;

  try {
    return await auditRpc({
      endpoint,
      apiKey: mode === "secure" ? apiKey : "",
      origin: mode === "secure"
        ? "http://localhost:3000"
        : "https://origen-no-autorizado.example",
      reportFile: reportFile ? path.resolve(reportFile) : undefined
    });
  } finally {
    server.close();
    await once(server, "close");
  }
}

module.exports = { ejecutarEscenario };
