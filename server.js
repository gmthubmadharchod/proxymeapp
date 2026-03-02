app.get("/proxy", async (req, res) => {

  const target = req.query.url;
  if (!target) return res.status(400).send("Missing URL");

  try {

    const urlObj = new URL(target);

    const allowed = ALLOWED_HOSTS.some(domain =>
      urlObj.hostname.endsWith(domain)
    );

    if (!allowed) {
      return res.status(403).send("Domain not allowed");
    }

    const response = await fetch(target, {
      headers: {
        Referer: "https://test.akamai.net.in/",
        Origin: "https://test.akamai.net.in",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const contentType = response.headers.get("content-type") || "";

    // 🔥 If m3u8 → rewrite
    if (contentType.includes("application/vnd.apple.mpegurl")) {

      let body = await response.text();

      const baseUrl = target.substring(0, target.lastIndexOf("/") + 1);

      body = body.split("\n").map(line => {

        if (line && !line.startsWith("#")) {

          // if relative path
          if (!line.startsWith("http")) {
            const absolute = baseUrl + line;
            return `/proxy?url=${encodeURIComponent(absolute)}`;
          }

          // if absolute
          return `/proxy?url=${encodeURIComponent(line)}`;
        }

        return line;
      }).join("\n");

      res.set("Content-Type", "application/vnd.apple.mpegurl");
      res.set("Access-Control-Allow-Origin", "*");

      return res.send(body);
    }

    // 🔥 Non-m3u8 files (ts, mp4)
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", contentType);

    response.body.pipe(res);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy Error");
  }
});
