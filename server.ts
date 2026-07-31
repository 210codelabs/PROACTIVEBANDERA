import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname: "0.0.0.0", port: 3000 });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  })
    .once("error", (err: any) => {
      console.error(err);
      process.exit(1);
    })
    .listen(3000, () => {
      console.log("> Ready on http://localhost:3000");
    });
});
