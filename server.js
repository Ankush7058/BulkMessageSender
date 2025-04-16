require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const xlsx = require("xlsx");
const cors = require("cors");
const venom = require("venom-bot");
const fs = require("fs");
const multer = require("multer");
const moment = require("moment");
const path = require("path");
const mime = require("mime-types");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/bulk-sender";

// ✅ Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// ✅ Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// ✅ Initialize Venom.js Client with Maximum Timeout
let client;
venom.create({
    session: "bulk-sender-session",
    multidevice: true,
    headless: true,
    disableSpins: true,
    browserArgs: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu"
    ],
    protocolTimeout: 600000, // ✅ Increased timeout to 5 minutes
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
}).then(async(cli) => {
    client = cli;
    console.log("✅ Venom.js Ready!");

    // ✅ Ensure WhatsApp Web is Ready Before Fetching Groups
    await client.isConnected();
    console.log("✅ WhatsApp Web is connected.");
}).catch((err) => console.log("❌ Venom Error:", err));

// ✅ Fix `/send-media` Route with Timeout Prevention
app.post("/send-media", upload.single("file"), async (req, res) => {
    let numbers = req.body.numbers;
    const message = req.body.message;
    let filePath = req.file ? req.file.path : null;

    console.log("📨 Received Request:", req.body);

    // ✅ Convert numbers into an array
    if (typeof numbers === "string") {
        try {
            numbers = JSON.parse(numbers);
        } catch (error) {
            return res.status(400).json({ error: "Invalid numbers format" });
        }
    }

    if (!Array.isArray(numbers) || numbers.length === 0) {
        return res.status(400).json({ error: "Numbers must be a valid array." });
    }

    // ✅ Fix File Extension Issue
    if (filePath) {
        const extension = mime.extension(req.file.mimetype);
        if (extension) {
            const newFilePath = `${req.file.path}.${extension}`;
            fs.renameSync(req.file.path, newFilePath);
            filePath = newFilePath;
        } else {
            return res.status(400).json({ error: "Unsupported file type" });
        }
    }

    let results = [];
    for (let number of numbers) {
        try {
            if (!number.startsWith("91")) {
                number = `91${number}`;
            }

            // ✅ Check Video File Size (Max: 64MB)
            if (filePath) {
                const fileSize = fs.statSync(filePath).size / (1024 * 1024); // Convert bytes to MB
                const fileExt = path.extname(filePath).toLowerCase();

                if (fileExt === ".mp4" && fileSize > 64) {
                    console.error(`❌ Video file too large (${fileSize.toFixed(2)} MB). Max allowed: 64MB.`);
                    results.push({ number, status: "Failed ❌", error: "Video file too large. Max: 64MB." });
                    continue;
                }
            }

            // ✅ Ensure WhatsApp Web is Ready Before Sending
            await client.isConnected();

            if (filePath) {
                console.log(`📁 Sending file to ${number}: ${filePath}`);
                await new Promise(resolve => setTimeout(resolve, 10000)); // ✅ Wait 10 seconds for large files
                await client.sendFile(`${number}@c.us`, filePath, path.basename(filePath), message);
            } else {
                console.log(`📩 Sending text to ${number}: ${message}`);
                await client.sendText(`${number}@c.us`, message);
            }

            results.push({ number, status: "Sent ✅" });
        } catch (error) {
            console.error(`❌ Error sending to ${number}:`, error.message);
            results.push({ number, status: "Failed ❌", error: error.message });
        }
    }

    // ✅ Delete file only after sending
    if (filePath) {
        fs.unlinkSync(filePath);
    }

    res.json({ results });
});
app.get("/get-groups", async (req, res) => {
    try {
        if (!client) {
            console.error("❌ WhatsApp client is not initialized yet.");
            return res.status(500).json({ error: "WhatsApp client is not initialized yet." });
        }

        console.log("🔄 Fetching WhatsApp groups...");

        const chats = await client.getAllChats();
console.log("📝 All Chats Fetched:", chats);


        if (!chats || chats.length === 0) {
            console.warn("⚠️ No WhatsApp groups found.");
            return res.json([]);
        }

        const groups = chats.filter(chat => {
            console.log("Checking chat:", chat);
            return chat.isGroup || chat.id.server === "g.us";
        }).map(group => ({
            name: group.name || "Unnamed Group",
            id: group.id._serialized
        }));
        
        console.log("✅ Filtered Groups:", groups);
        

        console.log("✅ Groups fetched successfully:", groups);
        res.json(groups);
    } catch (error) {
        console.error("❌ Error fetching groups:", error);
        res.status(500).json({ error: "Failed to fetch groups." });
    }
});


// ✅ Fix `/send-group-message` Route with Proper Base64 and File Handling
app.post("/send-group-message", upload.single("file"), async (req, res) => {
    try {
        let { groupId, message } = req.body;
        let filePath = req.file ? req.file.path : null;
        let timestamp = moment().format("YYYY-MM-DD HH:mm:ss");

        console.log("📨 Received Group Message Request:", req.body);

        if (!groupId || !message) {
            console.error("❌ Missing groupId or message in request!");
            return res.status(400).json({ error: "Group ID and message are required!" });
        }

        // ✅ Ensure WhatsApp Web is Connected Before Sending
        await client.isConnected();

        if (filePath) {
            const fileExt = path.extname(filePath).toLowerCase().replace(".", "");
            const allowedImageFormats = ["gif", "png", "jpg", "jpeg", "webp"];

            // ✅ Convert File to Base64 for Images Only
            const convertFileToBase64 = (filePath) => {
                try {
                    const fileBuffer = fs.readFileSync(filePath);
                    const mimeType = mime.lookup(filePath) || "application/octet-stream"; // Ensure MIME type
                    return { base64: fileBuffer.toString("base64"), mimeType };
                } catch (error) {
                    console.error("❌ Error converting file to Base64:", error);
                    return null;
                }
            };

            if (allowedImageFormats.includes(fileExt)) {
                const base64Data = convertFileToBase64(filePath);
                if (!base64Data) {
                    return res.status(500).json({ error: "Failed to convert file to base64." });
                }

                console.log(`📁 Sending image file to group ${groupId}`);
                await client.sendImageFromBase64(groupId, base64Data.base64, path.basename(filePath), message);
            } else {
                console.log(`📁 Sending document to group ${groupId}`);
                await client.sendFile(groupId, filePath, path.basename(filePath), message);
            }
        } else {
            console.log(`📩 Sending text message to group ${groupId}: ${message}`);
            await client.sendText(groupId, message);
        }

        // ✅ Delete File After Sending
        if (filePath) {
            fs.unlinkSync(filePath);
        }

        res.json({ status: "Sent ✅", group: groupId, time: timestamp });
    } catch (error) {
        console.error("❌ Error sending message to group:", error);
        res.status(500).json({ error: "Failed to send message." });
    }
});



// ✅ Start the Server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
