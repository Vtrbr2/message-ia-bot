import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

export async function initDatabase() {
  db = await open({
    filename: path.join(__dirname, '../data/database.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      sender TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      name TEXT NOT NULL,
      schedule_date DATETIME NOT NULL,
      schedule_time TEXT NOT NULL,
      status TEXT DEFAULT 'agendado',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

export async function saveMessage(phone, message, sender) {
  try {
    // Salvar/atualizar contato
    await db.run(
      'INSERT OR REPLACE INTO contacts (phone, name) VALUES (?, ?)',
      [phone, 'Cliente']
    );

    await db.run(
      'INSERT INTO messages (phone, message, sender) VALUES (?, ?, ?)',
      [phone, message, sender]
    );
  } catch (error) {
    console.error('Erro ao salvar mensagem:', error);
  }
}

export async function getMessages(phone = null) {
  try {
    let query = 'SELECT * FROM messages';
    let params = [];
    
    if (phone) {
      query += ' WHERE phone = ?';
      params.push(phone);
    }
    
    query += ' ORDER BY timestamp DESC';
    
    return await db.all(query, params);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    return [];
  }
}

export async function getContacts() {
  try {
    return await db.all(`
      SELECT c.phone, c.name, c.created_at, 
             COUNT(m.id) as message_count,
             MAX(m.timestamp) as last_contact
      FROM contacts c
      LEFT JOIN messages m ON c.phone = m.phone
      GROUP BY c.phone
      ORDER BY last_contact DESC
    `);
  } catch (error) {
    console.error('Erro ao buscar contatos:', error);
    return [];
  }
}

export async function saveSchedule(phone, name, scheduleDate, scheduleTime) {
  try {
    await db.run(
      'INSERT INTO schedules (phone, name, schedule_date, schedule_time) VALUES (?, ?, ?, ?)',
      [phone, name, scheduleDate.toISOString(), scheduleTime]
    );
  } catch (error) {
    console.error('Erro ao salvar agendamento:', error);
  }
}

export async function getSchedules() {
  try {
    return await db.all(`
      SELECT * FROM schedules 
      ORDER BY schedule_date DESC
    `);
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    return [];
  }
}

export async function getStats() {
  try {
    const contactsCount = await db.get('SELECT COUNT(*) as count FROM contacts');
    const messagesCount = await db.get('SELECT COUNT(*) as count FROM messages');
    const schedulesCount = await db.get('SELECT COUNT(*) as count FROM schedules');
    const todayMessages = await db.get(`
      SELECT COUNT(*) as count FROM messages 
      WHERE DATE(timestamp) = DATE('now')
    `);

    return {
      totalContacts: contactsCount.count,
      totalMessages: messagesCount.count,
      totalSchedules: schedulesCount.count,
      todayMessages: todayMessages.count
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return {};
  }
      }
