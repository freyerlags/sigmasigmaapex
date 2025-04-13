import express from "express";
import { createServer } from "http";
import path from "path";
import compression from "compression";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import wisp from "wisp-server-node";

const __dirname = process.cwd();
const publicPath = path.join(__dirname, "public");
const app = express();

// Place compression middleware at the top
app.use(compression({ level: 1, threshold: 0, filter: () => true, memLevel: 1, strategy: 1, windowBits: 9 }));

app.use("/baremux/", express.static(baremuxPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use(express.static(publicPath));
app.use("/uv/", express.static(uvPath));

/// we don't need this, / is automatically resolved to index.html
//app.get("/", (req, res) => {
//  res.sendFile(path.join(publicPath, "index.html"));
//});

const rawPort = process.env.PORT || "3000";
const port = parseInt(rawPort, 10);
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`Invalid port number: ${rawPort}`);
  process.exit(1);
}

const server = createServer(app);

server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/w/")) {
    try{
      wisp.routeRequest(req, socket, head);
    } catch(e){
      console.error("wisp error", e);
      socket.end();
    }
  } else {
    socket.end();
  }
});

server.on("listening", () => {
  const address = server.address();
  if (address && typeof address === "object") {
    console.log(`Server running at http://localhost:${address.port}`);
  } else {
    console.error("Failed to start server");
  }
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);
  try {
    await closeServer(server, "HTTP server");
    console.log("Server shut down successfully.");
    process.exit(0);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

function closeServer(server, name) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        console.error(`${name} close error: ${err.message}`);
        reject(err);
      } else {
        console.log(`${name} closed.`);
        resolve();
      }
    });
  });
}

server.listen(port);
