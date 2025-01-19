const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./model/user.model");
const Menu = require("./model/menu.model");

const bot = new TelegramBot(process.env.TOKEN, { polling: true });
const ADMIN_ID = 635595423;

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB ulanish muvaffaqiyatli"))
  .catch((err) => console.log("MongoDB ulanishda xato:", err));

async function updateUser(chatId, update) {
  try {
    await User.updateOne({ chatId }, update, { upsert: true });
  } catch (error) {
    console.error("Foydalanuvchini yangilashda xato:", error);
  }
}

const userMenu = {
  reply_markup: {
    keyboard: [["📋 Shikoyat", "✍ Taklif"], ["🍴 Menyu"]],
    resize_keyboard: true,
  },
};

const adminMenu = {
  reply_markup: {
    keyboard: [["Shikoyatlar", "Takliflar"], ["Menyu qo'shish"]],
    resize_keyboard: true,
  },
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || "No Name";
  const username = msg.from.username || "No Username";

  try {
    let user = await User.findOne({ chatId });
    if (!user) {
      user = new User({
        name,
        username,
        chatId,
        comments: [],
      });
      await user.save();

      if (chatId !== ADMIN_ID) {
        return bot.sendMessage(chatId, `Assalomu aleykum ${name}! Telefon raqamingizni yuboring.`, {
          reply_markup: {
            keyboard: [[{ text: "Telefon raqam yuborish", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
      }
    }

    if (chatId === ADMIN_ID) {
      bot.sendMessage(chatId, `Assalomu aleykum admin ${name}. Siz admin bo'limidasiz.`, adminMenu);
    } else {
      bot.sendMessage(chatId, "Menudan tanlang:", userMenu);
    }
  } catch (error) {
    console.error("/start xatolik:", error);
    bot.sendMessage(chatId, "Xatolik yuz berdi, iltimos qayta urinib ko'ring.");
  }
});

bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;
  const contact = msg.contact.phone_number;

  try {
    await updateUser(chatId, { phone: contact });
    bot.sendMessage(chatId, "Rahmat! Menudan tanlang:", userMenu);
  } catch (error) {
    console.error("Kontakt saqlashda xato:", error);
    bot.sendMessage(chatId, "Xatolik yuz berdi, iltimos qayta urinib ko'ring.");
  }
});

function handleFeedback(chatId, type) {
  const backButton = {
    reply_markup: {
      keyboard: [["⬅ Orqaga"]],
      resize_keyboard: true,
    },
  };

  bot.sendMessage(chatId, `${type}ingizni yuboring:`, backButton);

  bot.once("message", async (msg) => {
    if (msg.text === "⬅ Orqaga") {
      return bot.sendMessage(chatId, "Menudan tanlang:", userMenu);
    }

    try {
      await updateUser(chatId, { $push: { comments: { type: type.toLowerCase(), text: msg.text } } });
      bot.sendMessage(chatId, `${type}ingiz qabul qilindi. Rahmat!`, userMenu);
    } catch (error) {
      console.error(`${type} saqlashda xato:`, error);
      bot.sendMessage(chatId, "Xatolik yuz berdi, iltimos qayta urinib ko'ring.");
    }
  });
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  try {
    if (text === "📋 Shikoyat") {
      handleFeedback(chatId, "Shikoyat");
    } else if (text === "✍ Taklif") {
      handleFeedback(chatId, "Taklif");
    } else if (text === "🍴 Menyu") {
      const menuItems = await Menu.find();
      if (menuItems.length === 0) {
        bot.sendMessage(chatId, "Menyu bo'sh.");
      } else {
        const menuButtons = menuItems.map((item) => [{ text: item.name }]);
        bot.sendMessage(chatId, "Menyudan biror taomni tanlang:", {
          reply_markup: {
            keyboard: menuButtons,
            resize_keyboard: true,
          },
        });
      }
    } else {
      const selectedItem = await Menu.findOne({ name: text });
      if (selectedItem) {
        bot.sendPhoto(chatId, selectedItem.image, {
          caption: `🍽 ${selectedItem.name}\n💰 ${selectedItem.price} so'm`,
        });
      }
    }
  } catch (error) {
    console.error("Xabarni qayta ishlashda xato:", error);
    bot.sendMessage(chatId, "Xatolik yuz berdi, iltimos qayta urinib ko'ring.");
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (chatId === ADMIN_ID) {
    try {
      if (text === "Shikoyatlar") {
        const complaints = await User.find({ "comments.type": "shikoyat" });
        if (complaints.length === 0) {
          bot.sendMessage(chatId, "Hech qanday shikoyat yo'q.");
        } else {
          let response = "Shikoyatlar:\n";
          complaints.forEach((user) => {
            user.comments
              .filter((comment) => comment.type === "shikoyat")
              .forEach((comment) => {
                response += `- ${user.name}: ${comment.text}\n`;
              });
          });
          bot.sendMessage(chatId, response);
        }
      } else if (text === "Takliflar") {
        const suggestions = await User.find({ "comments.type": "taklif" });
        if (suggestions.length === 0) {
          bot.sendMessage(chatId, "Hech qanday taklif yo'q.");
        } else {
          let response = "Takliflar:\n";
          suggestions.forEach((user) => {
            user.comments
              .filter((comment) => comment.type === "taklif")
              .forEach((comment) => {
                response += `- ${user.name}: ${comment.text}\n`;
              });
          });
          bot.sendMessage(chatId, response);
        }
      } else if (text === "Menyu qo'shish") {
        bot.sendMessage(chatId, "Ovqat nomini kiriting:");
        bot.once("message", (msg1) => {
          const name = msg1.text;

          bot.sendMessage(chatId, "Ovqat narxini kiriting:");
          bot.once("message", (msg2) => {
            const price = parseFloat(msg2.text);
            if (isNaN(price)) {
              return bot.sendMessage(chatId, "Narx noto'g'ri formatda.");
            }

            bot.sendMessage(chatId, "Ovqat rasmini yuboring:");
            bot.once("photo", async (msg3) => {
              const photoId = msg3.photo?.[msg3.photo.length - 1]?.file_id;
              try {
                const newMenu = new Menu({ name, price, image: photoId });
                await newMenu.save();
                bot.sendMessage(chatId, "Menyu muvaffaqiyatli qo'shildi!");
              } catch (error) {
                console.error("Menyu qo'shishda xato:", error);
                bot.sendMessage(chatId, "Menyu qo'shishda xatolik yuz berdi.");
              }
            });
          });
        });
      }
    } catch (error) {
      console.error("Admin funksiyasi xatosi:", error);
      bot.sendMessage(chatId, "Xatolik yuz berdi, iltimos qayta urinib ko'ring.");
    }
  }
});
