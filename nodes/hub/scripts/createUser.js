import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import readline from 'readline';
const saltRounds = 10;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(saltRounds);
  const hash = await bcrypt.hash(password, salt);
  return hash;
};

// Function to insert a new user
const insertUser = async (username, password, tribe) => {
  const db = new sqlite3.Database('db/access.sqlite3');
  const passwordHash = await hashPassword(password);

  db.run(`INSERT INTO users (username, password_hash, tribe) VALUES (?, ?, ?)`, [username, passwordHash, tribe], function(err) {
    if (err) {
      console.error(err.message);
    } else {
      console.log(`A new user has been added with the ID ${this.lastID}`);
    }
    db.close();
    rl.close();
  });
};

rl.question('Enter username: ', (username) => {
  rl.question('Enter password: ', (password) => {
    rl.question('Enter tribe (world): ', (tribe) => {
      if (!tribe) {
        tribe = 'world';
      }
      insertUser(username, password, tribe);
    });
  });
});
