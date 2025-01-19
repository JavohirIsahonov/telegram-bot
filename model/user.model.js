const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: String,
    username: String,
    chatId: { type: String, unique: true },
    phone: String,
    comments: [
        {
            type: { type: String },
            text: String,
        },
    ],
});

module.exports = mongoose.model("User", UserSchema);
