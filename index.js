import express from 'express';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, saveMessage, getContacts, getMessages, saveSchedule, getSchedules, getStats } from './services/database.js';
import geminiService from './services/geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Inicializar banco de dados
initDatabase();

// Estado dos usuários
const userStates = new Map();
const userData = new Map();

// Templates disponíveis (40 templates falsos)
const templates = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  name: `Template ${i + 1}`,
  description: `Descrição detalhada do template ${i + 1} com design moderno e responsivo`,
  price: (100 + (i * 50)).toFixed(2),
  category: i % 4 === 0 ? 'E-commerce' : i % 4 === 1 ? 'Landing Page' : i % 4 === 2 ? 'Blog' : 'Institucional',
  features: ['Design Responsivo', 'Otimizado SEO', 'Suporte 30 dias'],
  delivery: '3-5 dias úteis'
}));

// Horários disponíveis (13h às 23h)
const availableSlots = Array.from({ length: 11 }, (_, i) => {
  const hour = i + 13;
  return `${hour}:00`;
});

// Cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "whatsapp-bot-business"
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// Gerar QR Code
client.on('qr', (qr) => {
  console.log('📱 QR Code recebido, escaneie com WhatsApp:');
  qrcode.generate(qr, { small: true });
});

// WhatsApp conectado
client.on('ready', () => {
  console.log('✅ WhatsApp conectado com sucesso!');
});

// Processar mensagens
client.on('message', async (message) => {
  try {
    const userPhone = message.from;
    const userMessage = message.body.trim();
    
    // Salvar mensagem no banco
    await saveMessage(userPhone, userMessage, 'user');

    console.log(`📨 Mensagem de ${userPhone}: ${userMessage}`);

    // Obter estado atual do usuário
    const currentState = userStates.get(userPhone) || 'menu';
    const userInfo = userData.get(userPhone) || {};

    // Processar de acordo com o estado
    switch(currentState) {
      case 'menu':
        await handleMenu(userPhone, userMessage, message, userInfo);
        break;
      case 'awaiting_budget_option':
        await handleBudgetOption(userPhone, userMessage, message, userInfo);
        break;
      case 'awaiting_template_selection':
        await handleTemplateSelection(userPhone, userMessage, message, userInfo);
        break;
      case 'awaiting_payment_decision':
        await handlePaymentDecision(userPhone, userMessage, message, userInfo);
        break;
      case 'awaiting_schedule_selection':
        await handleScheduleSelection(userPhone, userMessage, message, userInfo);
        break;
      default:
        await handleMenu(userPhone, userMessage, message, userInfo);
    }

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    await message.reply('❌ Ocorreu um erro. Tente novamente.');
  }
});

// Handler do Menu Principal
async function handleMenu(userPhone, userMessage, message, userInfo) {
  const contact = await message.getContact();
  const contactName = contact.name || contact.pushname || 'Cliente';
  
  userInfo.name = contactName;
  userData.set(userPhone, userInfo);

  if (userMessage.toLowerCase().includes('orçamento') || userMessage.toLowerCase().includes('orcamento')) {
    // Fluxo de orçamento personalizado
    const response = `Olá ${contactName}, agradeço por você ter entrado em contato conosco 😊. Para o nosso orçamento você deve escolher uma das opções abaixo:`;
    
    await message.reply(response);
    await saveMessage(userPhone, response, 'bot');
    
    // Enviar botões de opção
    const buttonMessage = await message.reply(`💎 *ESCOLHA UMA OPÇÃO:*\n\n` +
      `🛒 1. Escolher um modelo de site\n` +
      `👨‍💼 2. Falar com atendimento humano\n` +
      `💬 3. Outro tipo de projeto`);
    
    await saveMessage(userPhone, buttonMessage.body, 'bot');
    userStates.set(userPhone, 'awaiting_budget_option');
    
  } else if (userMessage === '1' || userMessage.toLowerCase().includes('template')) {
    await showTemplatesCatalog(userPhone, message);
    
  } else if (userMessage === '2' || userMessage.toLowerCase().includes('atendimento')) {
    await showScheduleOptions(userPhone, message);
    
  } else {
    // Resposta padrão com IA
    const aiResponse = await geminiService.generateResponse(userMessage, contactName);
    await message.reply(aiResponse);
    await saveMessage(userPhone, aiResponse, 'bot');
  }
}

// Handler de Opção de Orçamento
async function handleBudgetOption(userPhone, userMessage, message, userInfo) {
  if (userMessage.includes('1') || userMessage.toLowerCase().includes('modelo') || userMessage.toLowerCase().includes('escolher')) {
    await message.reply('Entendi! Olhe a lista abaixo e escolha uma das opções:');
    await showTemplatesCatalog(userPhone, message);
    
  } else if (userMessage.includes('2') || userMessage.toLowerCase().includes('atendimento') || userMessage.toLowerCase().includes('humano')) {
    await showScheduleOptions(userPhone, message);
    
  } else if (userMessage.includes('3') || userMessage.toLowerCase().includes('outro')) {
    await message.reply('Por favor, descreva brevemente seu projeto e entraremos em contato!');
    userStates.set(userPhone, 'menu');
    
  } else {
    await message.reply('Por favor, escolha uma opção válida (1, 2 ou 3).');
  }
}

// Mostrar catálogo de templates
async function showTemplatesCatalog(userPhone, message) {
  let catalogMessage = `🎨 *CATÁLOGO DE TEMPLATES* - ${templates.length} modelos disponíveis\n\n`;
  
  // Mostrar primeiros 5 templates como exemplo
  templates.slice(0, 5).forEach(template => {
    catalogMessage += `*${template.id}.* ${template.name}\n`;
    catalogMessage += `💵 R$ ${template.price} | 📦 ${template.delivery}\n`;
    catalogMessage += `📝 ${template.description}\n`;
    catalogMessage += `🏷️ ${template.category} | ⭐ ${template.features.join(', ')}\n\n`;
  });
  
  catalogMessage += `📋 *INSTRUÇÕES:*\n`;
  catalogMessage += `Digite o *NÚMERO* do template que gostou\n`;
  catalogMessage += `Ou digite *voltar* para o menu principal`;
  
  await message.reply(catalogMessage);
  await saveMessage(userPhone, catalogMessage, 'bot');
  userStates.set(userPhone, 'awaiting_template_selection');
}

// Handler de Seleção de Template
async function handleTemplateSelection(userPhone, userMessage, message, userInfo) {
  if (userMessage.toLowerCase() === 'voltar') {
    await message.reply('Voltando ao menu principal...');
    userStates.set(userPhone, 'menu');
    return;
  }

  const templateNumber = parseInt(userMessage);
  const template = templates.find(t => t.id === templateNumber);

  if (template) {
    userInfo.selectedTemplate = template;
    userData.set(userPhone, userInfo);
    
    const templateDetails = `🎯 *${template.name} - DETALHES*\n\n` +
      `📝 ${template.description}\n\n` +
      `💵 *Investimento:* R$ ${template.price}\n` +
      `📦 *Entrega:* ${template.delivery}\n` +
      `🏷️ *Categoria:* ${template.category}\n\n` +
      `⭐ *INCLUI:*\n${template.features.map(f => `✅ ${f}`).join('\n')}\n\n` +
      `💎 *PRÓXIMOS PASSOS:*\n` +
      `1️⃣ - Pagar agora e iniciar projeto\n` +
      `2️⃣ - Agendar atendimento para tirar dúvidas\n` +
      `3️⃣ - Ver mais templates`;
    
    await message.reply(templateDetails);
    await saveMessage(userPhone, templateDetails, 'bot');
    userStates.set(userPhone, 'awaiting_payment_decision');
    
  } else {
    await message.reply('❌ Template não encontrado. Digite o número correto ou *voltar* para o menu.');
  }
}

// Handler de Decisão de Pagamento
async function handlePaymentDecision(userPhone, userMessage, message, userInfo) {
  const template = userInfo.selectedTemplate;
  
  if (userMessage.includes('1') || userMessage.toLowerCase().includes('pagar')) {
    // Simular geração de PIX
    const pixMessage = `💎 *PAGAMENTO VIA PIX* 💎\n\n` +
      `Template: ${template.name}\n` +
      `Valor: R$ ${template.price}\n\n` +
      `📱 *Chave PIX:*\n` +
      `16997454758 (CPF/CNPJ)\n\n` +
      `🏢 *Beneficiário:* Vitor\n` +
      `💬 *Identificação:* Template ${template.id}\n\n` +
      `Após o pagamento, envie o comprovante para confirmarmos e iniciarmos seu projeto! 🚀`;
    
    await message.reply(pixMessage);
    await saveMessage(userPhone, pixMessage, 'bot');
    userStates.set(userPhone, 'menu');
    
  } else if (userMessage.includes('2') || userMessage.toLowerCase().includes('agendar')) {
    await showScheduleOptions(userPhone, message);
    
  } else if (userMessage.includes('3') || userMessage.toLowerCase().includes('mais')) {
    await showTemplatesCatalog(userPhone, message);
    
  } else {
    await message.reply('Por favor, escolha uma opção (1, 2 ou 3).');
  }
}

// Mostrar opções de agendamento
async function showScheduleOptions(userPhone, message) {
  const contact = await message.getContact();
  const contactName = contact.name || contact.pushname || 'Cliente';
  
  let scheduleMessage = `📅 *AGENDAMENTO DE ATENDIMENTO*\n\n` +
    `Olá ${contactName}! Escolha um horário disponível:\n\n`;
  
  availableSlots.forEach((slot, index) => {
    scheduleMessage += `${index + 1}. ${slot}\n`;
  });
  
  scheduleMessage += `\n💡 Digite o *NÚMERO* do horário desejado\n`;
  scheduleMessage += `Ou digite *voltar* para o menu principal`;
  
  await message.reply(scheduleMessage);
  await saveMessage(userPhone, scheduleMessage, 'bot');
  userStates.set(userPhone, 'awaiting_schedule_selection');
}

// Handler de Seleção de Horário
async function handleScheduleSelection(userPhone, userMessage, message, userInfo) {
  if (userMessage.toLowerCase() === 'voltar') {
    await message.reply('Voltando ao menu principal...');
    userStates.set(userPhone, 'menu');
    return;
  }

  const slotNumber = parseInt(userMessage);
  const selectedSlot = availableSlots[slotNumber - 1];

  if (selectedSlot) {
    const contact = await message.getContact();
    const contactName = contact.name || contact.pushname || 'Cliente';
    
    // Salvar agendamento no banco
    const scheduleDate = new Date();
    scheduleDate.setHours(parseInt(selectedSlot), 0, 0, 0);
    
    await saveSchedule(userPhone, contactName, scheduleDate, selectedSlot);
    
    const confirmationMessage = `✅ *AGENDAMENTO CONFIRMADO!*\n\n` +
      `👤 Cliente: ${contactName}\n` +
      `📅 Data: ${scheduleDate.toLocaleDateString('pt-BR')}\n` +
      `⏰ Horário: ${selectedSlot}\n\n` +
      `💡 *Instruções:*\n` +
      `- Estaremos disponíveis no horário agendado\n` +
      `- Você receberá uma lembrança 1h antes\n` +
      `- Para reagendar, entre em contato conosco\n\n` +
      `Obrigado por confiar em nosso trabalho! 🚀`;
    
    await message.reply(confirmationMessage);
    await saveMessage(userPhone, confirmationMessage, 'bot');
    userStates.set(userPhone, 'menu');
    
  } else {
    await message.reply('❌ Horário inválido. Escolha um número da lista ou digite *voltar*.');
  }
}

// API para o painel administrativo
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await getContacts();
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const phone = req.query.phone;
    const messages = await getMessages(phone);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/schedules', async (req, res) => {
  try {
    const schedules = await getSchedules();
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/whatsapp-status', (req, res) => {
  res.json({
    connected: client.info ? true : false,
    phone: client.info?.wid.user || 'Não conectado'
  });
});

// Rota principal do painel
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    whatsapp: client.info ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Painel administrativo: http://localhost:${PORT}`);
});

// Inicializar WhatsApp
client.initialize();
