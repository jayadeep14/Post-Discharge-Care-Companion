const express = require("express");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();
app.use(express.json());

const PORT = 3000;
const PYTHON_WEBHOOK_URL = "http://127.0.0.1:8001/webhook";
const client = new Client({
  authStrategy: new LocalAuth({ clientId: "personal-ai-bot" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("Scan with WhatsApp > Settings > Linked devices > Link a device:");
  qrcode.generate(qr, { small: true });
});
client.on("authenticated", () => console.log("WhatsApp authenticated"));
client.on("ready", () => console.log("WhatsApp bridge is ready"));
client.on("auth_failure", (error) => console.error("WhatsApp auth failed:", error));
client.on("disconnected", (reason) => console.error("WhatsApp disconnected:", reason));

client.on("message", async (message) => {
  try {
    if (!message.body || message.fromMe) return;
    const payload = {
      id: message.id?._serialized || `${message.from}:${message.timestamp}`,
      from: message.from,
      body: message.body,
      fromMe: message.fromMe,
    };
    const response = await fetch(PYTHON_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error("Python webhook error:", response.status, await response.text());
    }
  } catch (error) {
    console.error("Could not forward incoming WhatsApp message:", error);
  }
});

app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body || {};
    if (typeof to !== "string" || !to || typeof message !== "string" || !message) {
      return res.status(400).json({ error: "Expected non-empty string fields 'to' and 'message'." });
    }
    await client.sendMessage(to, message);
    return res.json({ status: "sent" });
  } catch (error) {
    console.error("Could not send WhatsApp message:", error);
    return res.status(500).json({ error: String(error) });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`WhatsApp bridge listening at http://127.0.0.1:${PORT}`);
});
client.initialize();
