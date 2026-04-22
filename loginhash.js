import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt'; // 1. Імпортуємо bcrypt

dotenv.config();

const { Pool } = pg;
const saltRounds = 10; // Складність хешування

if (!process.env.DB_URL) {
  console.error('❌ Помилка: DB_URL не знайдено в .env файлі!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

const initializeDatabase = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS my_tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT, -- Тут ми будемо зберігати хеш
      priority INTEGER DEFAULT 1,
      is_done BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(createTableQuery);
    console.log('✅ База даних підключена, таблиця готова.');
  } catch (error) {
    console.error('❌ Помилка ініціалізації БД:', error.message);
    process.exit(1);
  }
};

async function addTask(title, desc, priority) {
  try {
    // 2. Хешуємо опис перед збереженням
    console.log('⏳ Хешування опису...');
    const hashedDesc = await bcrypt.hash(desc, saltRounds);
    
    const query = `INSERT INTO my_tasks (title, description, priority) VALUES ($1, $2, $3) RETURNING *`;
    const res = await pool.query(query, [title, hashedDesc, priority]);
    
    console.log('✅ Додано запис із хешованим описом:', res.rows[0]);
  } catch (err) {
    console.error('❌ Помилка при додаванні:', err.message);
  }
}

async function listTasks() {
  const res = await pool.query('SELECT * FROM my_tasks ORDER BY priority DESC');
  console.table(res.rows);
}

async function deleteTask(id) {
  const res = await pool.query('DELETE FROM my_tasks WHERE id = $1 RETURNING *', [id]);
  if (res.rows.length) {
    console.log('🗑️ Видалено:', res.rows[0]);
  } else {
    console.log('ℹ️ Запис з таким ID не знайдено.');
  }
}

(async () => {
  await initializeDatabase();
  
  const [,, command, ...args] = process.argv;

  try {
    switch (command) {
      case 'add':
        if (!args[0]) {
          console.log('Помилка: вкажіть назву завдання.');
        } else {
          // Передаємо назву, опис (який захешується) та пріоритет
          await addTask(args[0], args[1] || 'default_secret', args[2] || 1);
        }
        break;
      case 'list':
        await listTasks();
        break;
      case 'delete':
        await deleteTask(parseInt(args[0]));
        break;
      default:
        console.log(`
🚀 Доступні команди:
  node loginhash.js add "Назва" 
  node loginhash list
  node loginhash delete ID
        `);
    }
  } catch (err) {
    console.error('❌ Помилка:', err.message);
  } finally {
    await pool.end();
    console.log('🔌 З’єднання закрито');
  }
})();