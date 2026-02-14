import fs from "fs";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function menu() {
  console.log(`
========= TOKEN MENU =========
1️⃣ Показати metadata
2️⃣ Змінити NAME
3️⃣ Змінити SYMBOL
4️⃣ Змінити IMAGE (PNG URL)
5️⃣ Змінити DESCRIPTION
6️⃣ Змінити METADATA URI (https://)
7️⃣ Показати MINT
8️⃣ ВИЙТИ
==============================
`);
}

function loadMetadata() {
  return JSON.parse(fs.readFileSync("metadata.json", "utf8"));
}

function saveMetadata(data) {
  fs.writeFileSync("metadata.json", JSON.stringify(data, null, 2));
}

function ask(q) {
  return new Promise(res => rl.question(q, res));
}

async function run() {
  while (true) {
    menu();
    const choice = await ask("➡️ Обери дію: ");

    if (choice === "1") {
      console.log(loadMetadata());
    }

    if (choice === "2") {
      const md = loadMetadata();
      md.name = await ask("Нова назва: ");
      saveMetadata(md);
      console.log("✅ NAME оновлено");
    }

    if (choice === "3") {
      const md = loadMetadata();
      md.symbol = await ask("Новий символ: ");
      saveMetadata(md);
      console.log("✅ SYMBOL оновлено");
    }

    if (choice === "4") {
      const md = loadMetadata();
      md.image = await ask("PNG URL (https://): ");
      saveMetadata(md);
      console.log("✅ IMAGE оновлено");
    }

    if (choice === "5") {
      const md = loadMetadata();
      md.description = await ask("Опис: ");
      saveMetadata(md);
      console.log("✅ DESCRIPTION оновлено");
    }

    if (choice === "6") {
      const uri = await ask("Новий metadata URI: ");
      fs.writeFileSync("metadata_uri.txt", uri);
      console.log("✅ URI збережено");
    }

    if (choice === "7") {
      console.log("🪙 MINT:", fs.readFileSync("mint.txt", "utf8"));
    }

    if (choice === "8") {
      console.log("👋 Вихід");
      process.exit(0);
    }
  }
}

run();
