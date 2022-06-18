import { Client } from "nodeamino";

const client = await new Client().login(
    "YOUR_EMAIL",
    "YOUR_PASSWORD"
); // Login to account

client.startPolling(); // Start listening to messages

client.command("!hello", async msg => {
    await msg.reply("Hello, world!"); // Reply to the message
}); // On "!hello" message
