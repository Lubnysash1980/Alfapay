// save-key.mjs
import bs58 from "bs58";
import fs from "fs";

// 🔑 Встав тут свій приватний ключ у Base58 форматі (рядок з wallet export)
const secretBase58 = "3JAPdR6DWQS2dgRzTeLESLXdRPy3rEfETRCa1UpLCNLSaEiCU4c8GHrhuwWKi2at6oTqBj1GiKbKHRPxLJfKeQaM"; 

// Декодуємо у масив чисел
const secretArray = Array.from(bs58.decode(secretBase58));

// Записуємо у JSON файл
fs.writeFileSync("mint-authority.json", JSON.stringify(secretArray));

console.log("✅ Ключ збережено у mint-authority.json");
