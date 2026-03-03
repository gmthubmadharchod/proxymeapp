import express from "express";
import fetch from "node-fetch";

const app = express();

/* 🔐 Allowed Domains */
const ALLOWED_HOSTS = [
  "akamai.net.in",
  "classx.co.in",
  "cloud-front.in",
  "appx.co.in"
];

/* ================================
   🔥 MAIN PROXY ROUTE
================================ */
app.get("/proxy", async (req, res) => {

  const target = req.query.url;
  if (!target) return res.status(400).send("Missing URL");

  try {

    const urlObj = new URL(target);

    // 🔐 Security check
    const allowed = ALLOWED_HOSTS.some(domain =>
      urlObj.hostname.endsWith(domain)
    );

    if (!allowed) {
      return res.status(403).send("Domain not allowed");
    }

    // 🔥 Fetch from original server
    const response = await fetch(target, {
      headers: {
        Referer: "https://test.akamai.net.in/",
        Origin: "https://test.akamai.net.in",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const contentType = response.headers.get("content-type") || "";

    /* ================================
       🔥 If M3U8 → Rewrite Segments
    ================================= */
    if (contentType.includes("application/vnd.apple.mpegurl") ||
        contentType.includes("application/x-mpegURL")) {

      let body = await response.text();

      const baseUrl =
        target.substring(0, target.lastIndexOf("/") + 1);

      body = body.split("\n").map(line => {

        // ignore comments
        if (!line || line.startsWith("#")) {
          return line;
        }

        // absolute URL
        if (line.startsWith("http")) {
          return `/proxy?url=${encodeURIComponent(line)}`;
        }

        // relative URL
        const absolute = baseUrl + line;
        return `/proxy?url=${encodeURIComponent(absolute)}`;

      }).join("\n");

      res.set("Content-Type", "application/vnd.apple.mpegurl");
      res.set("Access-Control-Allow-Origin", "*");

      return res.send(body);
    }

    /* ================================
       🔥 Non-M3U8 Files (.ts, .mp4)
    ================================= */
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", contentType);

    if (req.query.download === "1") {
      res.set(
         "Content-Disposition",
         "attachment; filename=video.mp4"
      );
    }

    response.body.pipe(res);

  } catch (err) {
    console.error("Proxy Error:", err.message);
    res.status(500).send("Proxy Error");
  }
});

/* ================================
   🔥 Root Check
================================ */
app.get("/", (req, res) => {
  res.send("🚀 HLS Proxy Running");
});

/* ================================
   🔥 Render Compatible Port
================================ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});



