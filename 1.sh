# 1️⃣ Оновлення Termux
pkg update -y && pkg upgrade -y
pkg install wget git -y

# 2️⃣ Встановлення Solana CLI
sh -c "$(wget -qO- https://release.solana.com/stable/install)"

# 3️⃣ Додаємо Solana CLI в PATH (тимчасово та на постійно)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 4️⃣ Перевіряємо версію Solana CLI
solana --version
spl-token --version

# 5️⃣ Перевірка балансу SOL гаманця mint authority
solana balance 6UfuPitEsgrfC28EskXkrrqnKt5JTp8rMNd7SYAUfvrd

# 6️⃣ Створюємо Associated Token Account для токена
spl-token create-account 3JAPdR6DWQS2dgRzTeLESLXdRPy3rEfETRCa1UpLCNLSaEiCU4c8GHrhuwWKi2at6oTqBj1GiKbKHRPxLJfKeQaM --owner EPEhVVhY7AXzWqcJeidWNuBqNbGDjJF35JzPVFXEbYxv

# 7️⃣ Тепер можна запускати скрипт mint.js без помилок TokenAccountNotFoundError
node mint.js
