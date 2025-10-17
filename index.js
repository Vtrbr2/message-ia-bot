import express from 'express';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, saveMessage, getContacts, getMessages, saveSchedule, getSchedules, getStats } from './services/database.js';
import { generateResponse } from './services/geminiService.js';
import whatsappService from './services/whatsappService.js';

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

// Templates disponíveis (40 templates)
const templates = [
  {
    id: 1,
    name: "Site Institucional Premium",
    description: "Site profissional completo com 5 páginas, design responsivo e SEO otimizado",
    price: "497.00",
    category: "Institucional",
    features: ["5 páginas", "Design responsivo", "Formulário de contato", "SEO básico"],
    delivery: "3-5 dias"
  },
  {
    id: 2,
    name: "E-commerce Básico",
    description: "Loja virtual com até 50 produtos, carrinho e integração com pagamentos",
    price: "897.00",
    category: "E-commerce", 
    features: ["Até 50 produtos", "Carrinho de compras", "Gateway de pagamento", "Painel admin"],
    delivery: "5-7 dias"
  },
  {
    id: 3,
    name: "Landing Page de Vendas",
    description: "Página de captura otimizada para conversões com formulário e WhatsApp",
    price: "297.00",
    category: "Landing Page",
    features: ["Design high-conversion", "Formulário de lead", "Integração WhatsApp", "Otimizado mobile"],
    delivery: "2-3 dias"
  },
  {
    id: 4,
    name: "Blog Profissional", 
    description: "Blog moderno com sistema de posts, categorias e design clean",
    price: "397.00",
    category: "Blog",
    features: ["Sistema de posts", "Categorias e tags", "Área de comentários", "Design responsivo"],
    delivery: "4-6 dias"
  },
  {
    id: 5,
    name: "Site One Page",
    description: "Site single page com rolagem suave e design moderno",
    price: "247.00",
    category: "One Page",
    features: ["Design one page", "Rolagem suave", "Animações CSS", "Otimizado SEO"],
    delivery: "2-4 dias"
  }
];

// Adicionar mais 35 templates
for (let i = 6; i <= 40; i++) {
  templates.push({
    id: i,
    name: `Template Profissional ${i}`,
    description: `Template moderno e responsivo ideal para diversos tipos de negócios - Modelo ${i}`,
    price: (200 + (i * 20)).toFixed(2),
    category: ["E-commerce", "Landing Page", "Blog", "Institucional"][i % 4],
    features: ["Design Responsivo", "Otimizado SEO", "Suporte 30 dias", "Entrega Rápida"],
    delivery: "3-5 dias"
  });
}

// Horários disponíveis (13h às 23h)
const availableSlots = [];
for (let hour = 13; hour <= 23; hour++) {
  availableSlots.push(`${hour}:00`);
}

// Cliente WhatsApp
whatsappService.initialize()

// Gerar QR Code
client.on('qr', (qr) => {
  console.log('📱 QR Code recebido, escaneie com WhatsApp:');
  qrcode.generate(qr, { small: true });
});

// WhatsApp conectado
client.on('ready', () => {
  console.log('✅ WhatsApp conectado com sucesso!');
  console.log('🤖 Bot iniciado e pronto para receber mensagens!');
});

// Processar mensagens
client.on('message', async (message) => {
  try {
    const userPhone = message.from;
    const userMessage = message.body.trim();
    
    // Salvar mensagem no banco
    await saveMessage(userPhone, userMessage, 'user');

    console.log(`📨 [${userPhone}]: ${userMessage}`);

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

  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('orçamento') || lowerMessage.includes('orcamento') || lowerMessage.includes('desejo um orçamento personalizado')) {
    // Fluxo de orçamento personalizado
    const response = `Olá ${contactName}, agradeço por você ter entrado em contato conosco 😊. Para o nosso orçamento você deve escolher uma das opções abaixo:`;
    
    await message.reply(response);
    await saveMessage(userPhone, response, 'bot');
    
    // Enviar opções
    const optionsMessage = `💎 *ESCOLHA UMA OPÇÃO:*\n\n` +
      `🎨 *1. ESCOLHER UM MODELO DE SITE*\n` +
      `👨‍💼 *2. FALAR COM ATENDIMENTO HUMANO*\n` +
      `💬 *3. DESCREVER MEU PROJETO*`;
    
    await message.reply(optionsMessage);
    await saveMessage(userPhone, optionsMessage, 'bot');
    userStates.set(userPhone, 'awaiting_budget_option');
    
  } else if (lowerMessage === '1' || lowerMessage.includes('template') || lowerMessage.includes('modelo')) {
    await showTemplatesCatalog(userPhone, message);
    
  } else if (lowerMessage === '2' || lowerMessage.includes('atendimento') || lowerMessage.includes('humano')) {
    await showScheduleOptions(userPhone, message);
    
  } else if (lowerMessage === '3' || lowerMessage.includes('projeto')) {
    await message.reply('📝 Por favor, descreva brevemente seu projeto que entraremos em contato para um orçamento personalizado!');
    userStates.set(userPhone, 'menu');
    
  } else if (lowerMessage.includes('ola') || lowerMessage.includes('olá') || lowerMessage === 'oi') {
    const welcomeMessage = `👋 Olá ${contactName}! Seja bem-vindo(a)! 😊\n\n` +
      `Sou seu assistente virtual e posso ajudar você com:\n\n` +
      `🎨 *Orçamento de sites e templates*\n` +
      `📅 *Agendamento de atendimento*\n` +
      `💬 *Tirar dúvidas sobre nossos serviços*\n\n` +
      `Digite *"orçamento"* para começarmos!`;
    
    await message.reply(welcomeMessage);
    await saveMessage(userPhone, welcomeMessage, 'bot');
    
  } else {
    // Resposta inteligente com Gemini
    const aiResponse = await generateResponse(userMessage, contactName);
    await message.reply(aiResponse);
    await saveMessage(userPhone, aiResponse, 'bot');
  }
}

// Handler de Opção de Orçamento
async function handleBudgetOption(userPhone, userMessage, message, userInfo) {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('1') || lowerMessage.includes('escolher') || lowerMessage.includes('modelo')) {
    await message.reply('Entendi! Olhe a lista abaixo e escolha uma das opções:');
    await showTemplatesCatalog(userPhone, message);
    
  } else if (lowerMessage.includes('2') || lowerMessage.includes('atendimento') || lowerMessage.includes('humano')) {
    await showScheduleOptions(userPhone, message);
    
  } else if (lowerMessage.includes('3') || lowerMessage.includes('projeto') || lowerMessage.includes('descrever')) {
    await message.reply('📝 Perfeito! Por favor, descreva brevemente seu projeto:\n\n• Tipo de site necessário\n• Funcionalidades desejadas\n• Prazo estimado\n\nEnviaremos um orçamento personalizado! 🚀');
    userStates.set(userPhone, 'menu');
    
  } else {
    await message.reply('❌ Por favor, escolha uma opção válida:\n\n1 - Escolher modelo de site\n2 - Atendimento humano\n3 - Descrever meu projeto');
  }
}

// Mostrar catálogo de templates
async function showTemplatesCatalog(userPhone, message) {
  let catalogMessage = `🎨 *CATÁLOGO DE TEMPLATES* - ${templates.length} modelos disponíveis\n\n`;
  
  // Mostrar primeiros 8 templates
  templates.slice(0, 8).forEach(template => {
    catalogMessage += `*${template.id}.* 🏷️ ${template.name}\n`;
    catalogMessage += `   💵 R$ ${template.price} | 📦 ${template.delivery}\n`;
    catalogMessage += `   📝 ${template.description.substring(0, 60)}...\n`;
    catalogMessage += `   🏷️ ${template.category} | ⭐ ${template.features.slice(0, 2).join(', ')}\n\n`;
  });
  
  catalogMessage += `📋 *INSTRUÇÕES:*\n`;
  catalogMessage += `Digite o *NÚMERO* do template que gostou para ver detalhes\n`;
  catalogMessage += `Ou digite *voltar* para o menu principal`;
  
  await message.reply(catalogMessage);
  await saveMessage(userPhone, catalogMessage, 'bot');
  userStates.set(userPhone, 'awaiting_template_selection');
}

// Handler de Seleção de Template
async function handleTemplateSelection(userPhone, userMessage, message, userInfo) {
  if (userMessage.toLowerCase() === 'voltar' || userMessage === '0') {
    await message.reply('Voltando ao menu principal...');
    userStates.set(userPhone, 'menu');
    return;
  }

  const templateNumber = parseInt(userMessage);
  const template = templates.find(t => t.id === templateNumber);

  if (template) {
    userInfo.selectedTemplate = template;
    userData.set(userPhone, userInfo);
    
    const templateDetails = `🎯 *${template.name} - DETALHES COMPLETOS*\n\n` +
      `📝 ${template.description}\n\n` +
      `💰 *Investimento:* R$ ${template.price}\n` +
      `📦 *Entrega:* ${template.delivery}\n` +
      `🏷️ *Categoria:* ${template.category}\n\n` +
      `⭐ *INCLUI:*\n${template.features.map(f => `✅ ${f}`).join('\n')}\n\n` +
      `💎 *PRÓXIMOS PASSOS:*\n` +
      `1️⃣ - *PAGAR AGORA* e iniciar projeto imediatamente\n` +
      `2️⃣ - *AGENDAR ATENDIMENTO* para tirar dúvidas\n` +
      `3️⃣ - *VER MAIS TEMPLATES*\n` +
      `4️⃣ - *VOLTAR* ao menu principal`;
    
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
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('1') || lowerMessage.includes('pagar') || lowerMessage.includes('comprar')) {
    // Gerar PIX
    const pixMessage = `💎 *PAGAMENTO VIA PIX* 💎\n\n` +
      `🛒 *Produto:* ${template.name}\n` +
      `💵 *Valor:* R$ ${template.price}\n\n` +
      `📱 *CHAVE PIX (CPF/CNPJ):*\n` +
      `16997454758\n\n` +
      `🏢 *Beneficiário:* Vitor\n` +
      `💬 *Identificação:* Template ${template.id} - ${template.name}\n\n` +
      `⚠️ *INSTRUÇÕES:*\n` +
      `1. Realize o pagamento via PIX para a chave acima\n` +
      `2. Envie o comprovante para confirmarmos\n` +
      `3. Iniciaremos seu projeto imediatamente!\n\n` +
      `🚀 *Após o pagamento, seu site estará pronto em ${template.delivery}!*`;
    
    await message.reply(pixMessage);
    await saveMessage(userPhone, pixMessage, 'bot');
    userStates.set(userPhone, 'menu');
    
  } else if (lowerMessage.includes('2') || lowerMessage.includes('agendar') || lowerMessage.includes('atendimento')) {
    await showScheduleOptions(userPhone, message);
    
  } else if (lowerMessage.includes('3') || lowerMessage.includes('mais') || lowerMessage.includes('templates')) {
    await showTemplatesCatalog(userPhone, message);
    
  } else if (lowerMessage.includes('4') || lowerMessage.includes('voltar')) {
    await message.reply('Voltando ao menu principal...');
    userStates.set(userPhone, 'menu');
    
  } else {
    await message.reply('❌ Por favor, escolha uma opção válida (1, 2, 3 ou 4).');
  }
}

// Mostrar opções de agendamento
async function showScheduleOptions(userPhone, message) {
  const contact = await message.getContact();
  const contactName = contact.name || contact.pushname || 'Cliente';
  
  let scheduleMessage = `📅 *AGENDAMENTO DE ATENDIMENTO*\n\n` +
    `Olá ${contactName}! Escolha um horário disponível para nosso atendimento:\n\n`;
  
  availableSlots.forEach((slot, index) => {
    scheduleMessage += `${index + 1}. 🕐 ${slot}\n`;
  });
  
  scheduleMessage += `\n💡 *INSTRUÇÕES:*\n`;
  scheduleMessage += `Digite o *NÚMERO* do horário desejado\n`;
  scheduleMessage += `Ou digite *voltar* para o menu principal`;
  
  await message.reply(scheduleMessage);
  await saveMessage(userPhone, scheduleMessage, 'bot');
  userStates.set(userPhone, 'awaiting_schedule_selection');
}

// Configure os callbacks se necessário
whatsappService.onReady = () => {
  console.log('✅ Bot WhatsApp totalmente inicializado!');
};

whatsappService.onQRCode = (qr) => {
  console.log('QR Code gerado para autenticação');
};
// Handler de Seleção de Horário
async function handleScheduleSelection(userPhone, userMessage, message, userInfo) {
  if (userMessage.toLowerCase() === 'voltar' || userMessage === '0') {
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
      `👤 *Cliente:* ${contactName}\n` +
      `📅 *Data:* ${scheduleDate.toLocaleDateString('pt-BR')}\n` +
      `⏰ *Horário:* ${selectedSlot}\n\n` +
      `💡 *INFORMAÇÕES IMPORTANTES:*\n` +
      `• Estaremos disponíveis no WhatsApp no horário agendado\n` +
      `• Você receberá uma lembrança 1 hora antes\n` +
      `• Para reagendar ou cancelar, entre em contato\n\n` +
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
    phone: client.info?.wid.user || 'Não conectado',
    qrCode: null
  });
});

// Rota para obter templates
app.get('/api/templates', (req, res) => {
  res.json(templates);
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
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Painel administrativo: http://localhost:${PORT}`);
  console.log(`🔧 Health check: http://localhost:${PORT}/health`);
});

// Inicializar WhatsApp
client.initialize();
