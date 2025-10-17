import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

export async function initDatabase() {
  try {
    db = await open({
      filename: path.join(__dirname, '../data/database.db'),
      driver: sqlite3.Database
    });

    // Criar tabelas
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_contact DATETIME DEFAULT CURRENT_TIMESTAMP
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

    console.log('✅ Banco de dados inicializado com sucesso!');
    return db;
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

export async function saveMessage(phone, message, sender) {
  try {
    // Salvar/atualizar contato
    await db.run(
      `INSERT INTO contacts (phone, name, last_contact) 
       VALUES (?, ?, CURRENT_TIMESTAMP) 
       ON CONFLICT(phone) DO UPDATE SET 
       last_contact = CURRENT_TIMESTAMP`,
      [phone, 'Cliente']
    );

    // Salvar mensagem
    await db.run(
      'INSERT INTO messages (phone, message, sender) VALUES (?, ?, ?)',
      [phone, message, sender]
    );
  } catch (error) {
    console.error('❌ Erro ao salvar mensagem:', error);
  }
}

export async function getMessages(phone = null) {
  try {
    let query = `
      SELECT m.*, c.name 
      FROM messages m 
      LEFT JOIN contacts c ON m.phone = c.phone
    `;
    let params = [];
    
    if (phone) {
      query += ' WHERE m.phone = ?';
      params.push(phone);
    }
    
    query += ' ORDER BY m.timestamp ASC';
    
    return await db.all(query, params);
  } catch (error) {
    console.error('❌ Erro ao buscar mensagens:', error);
    return [];
  }
}

export async function getContacts() {
  try {
    return await db.all(`
      SELECT 
        c.phone, 
        c.name, 
        c.created_at,
        c.last_contact,
        COUNT(m.id) as message_count,
        MAX(m.timestamp) as last_message
      FROM contacts c
      LEFT JOIN messages m ON c.phone = m.phone
      GROUP BY c.phone
      ORDER BY c.last_contact DESC
    `);
  } catch (error) {
    console.error('❌ Erro ao buscar contatos:', error);
    return [];
  }
}

export async function saveSchedule(phone, name, scheduleDate, scheduleTime) {
  try {
    await db.run(
      `INSERT INTO schedules (phone, name, schedule_date, schedule_time) 
       VALUES (?, ?, ?, ?)`,
      [phone, name, scheduleDate.toISOString(), scheduleTime]
    );
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar agendamento:', error);
    return false;
  }
}

export async function getSchedules() {
  try {
    return await db.all(`
      SELECT 
        s.*,
        c.name as contact_name
      FROM schedules s
      LEFT JOIN contacts c ON s.phone = c.phone
      ORDER BY s.schedule_date DESC, s.schedule_time ASC
    `);
  } catch (error) {
    console.error('❌ Erro ao buscar agendamentos:', error);
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
    const weekMessages = await db.get(`
      SELECT COUNT(*) as count FROM messages 
      WHERE timestamp > datetime('now', '-7 days')
    `);

    return {
      totalContacts: contactsCount.count,
      totalMessages: messagesCount.count,
      totalSchedules: schedulesCount.count,
      todayMessages: todayMessages.count,
      weekMessages: weekMessages.count
    };
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    return {
      totalContacts: 0,
      totalMessages: 0,
      totalSchedules: 0,
      todayMessages: 0,
      weekMessages: 0
    };
  }
                  }
