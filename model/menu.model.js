const mongoose = require("mongoose");

const MenuSchema = new mongoose.Schema({
    name: String,
    price: Number,
    image: String, // Telegram file_id saqlanadi
});

module.exports = mongoose.model("Menu", MenuSchema);
