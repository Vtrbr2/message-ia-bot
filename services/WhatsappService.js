import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { saveMessage, saveSchedule, getContacts } from './database.js';
import { generateResponse } from './geminiService.js';

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.userStates = new Map();
    this.userData = new Map();
    this.onQRCode = null;
    this.onReady = null;
    this.onMessage = null;
  }

  initialize() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: "whatsapp-bot-business"
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
      }
    });

    this.setupEventHandlers();
    this.client.initialize();
  }

  setupEventHandlers() {
    this.client.on('qr', (qr) => {
      console.log('📱 QR Code recebido!');
      qrcode.generate(qr, { small: true });
      
      if (this.onQRCode) {
        this.onQRCode(qr);
      }
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp conectado com sucesso!');
      this.isConnected = true;
      
      if (this.onReady) {
        this.onReady();
      }
    });

    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp autenticado!');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ Falha na autenticação:', msg);
      this.isConnected = false;
    });

    this.client.on('disconnected', (reason) => {
      console.log('🔌 WhatsApp desconectado:', reason);
      this.isConnected = false;
    });

    this.client.on('message', async (message) => {
      await this.handleIncomingMessage(message);
      
      if (this.onMessage) {
        this.onMessage(message);
      }
    });
  }

  async handleIncomingMessage(message) {
    try {
      const userPhone = message.from;
      const userMessage = message.body.trim();
      
      // Ignorar mensagens de grupo e status
      if (message.isGroupMsg || message.isStatus) {
        return;
      }

      console.log(`📨 Mensagem de ${userPhone}: ${userMessage}`);

      // Salvar mensagem no banco
      await saveMessage(userPhone, userMessage, 'user');

      // Obter estado atual do usuário
      const currentState = this.userStates.get(userPhone) || 'menu';
      const userInfo = this.userData.get(userPhone) || {};

      // Processar de acordo com o estado
      switch(currentState) {
        case 'menu':
          await this.handleMenu(userPhone, userMessage, message, userInfo);
          break;
        case 'awaiting_budget_option':
          await this.handleBudgetOption(userPhone, userMessage, message, userInfo);
          break;
        case 'awaiting_template_selection':
          await this.handleTemplateSelection(userPhone, userMessage, message, userInfo);
          break;
        case 'awaiting_payment_decision':
          await this.handlePaymentDecision(userPhone, userMessage, message, userInfo);
          break;
        case 'awaiting_schedule_selection':
          await this.handleScheduleSelection(userPhone, userMessage, message, userInfo);
          break;
        default:
          await this.handleMenu(userPhone, userMessage, message, userInfo);
      }

    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      await this.sendMessage(message.from, '❌ Ocorreu um erro. Tente novamente.');
    }
  }

  async handleMenu(userPhone, userMessage, message, userInfo) {
    const contact = await message.getContact();
    const contactName = contact.name || contact.pushname || 'Cliente';
    
    userInfo.name = contactName;
    this.userData.set(userPhone, userInfo);

    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('orçamento') || lowerMessage.includes('orcamento') || lowerMessage.includes('desejo um orçamento personalizado')) {
      const response = `Olá ${contactName}, agradeço por você ter entrado em contato conosco 😊. Para o nosso orçamento você deve escolher uma das opções abaixo:`;
      
      await this.sendMessage(userPhone, response);
      
      const optionsMessage = `💎 *ESCOLHA UMA OPÇÃO:*\n\n` +
        `🎨 *1. ESCOLHER UM MODELO DE SITE*\n` +
        `👨‍💼 *2. FALAR COM ATENDIMENTO HUMANO*\n` +
        `💬 *3. DESCREVER MEU PROJETO*`;
      
      await this.sendMessage(userPhone, optionsMessage);
      this.userStates.set(userPhone, 'awaiting_budget_option');
      
    } else if (lowerMessage === '1' || lowerMessage.includes('template') || lowerMessage.includes('modelo')) {
      await this.showTemplatesCatalog(userPhone);
      
    } else if (lowerMessage === '2' || lowerMessage.includes('atendimento') || lowerMessage.includes('humano')) {
      await this.showScheduleOptions(userPhone);
      
    } else if (lowerMessage === '3' || lowerMessage.includes('projeto')) {
      await this.sendMessage(userPhone, '📝 Por favor, descreva brevemente seu projeto que entraremos em contato para um orçamento personalizado!');
      this.userStates.set(userPhone, 'menu');
      
    } else if (lowerMessage.includes('ola') || lowerMessage.includes('olá') || lowerMessage === 'oi') {
      const welcomeMessage = `👋 Olá ${contactName}! Seja bem-vindo(a)! 😊\n\n` +
        `Sou seu assistente virtual e posso ajudar você com:\n\n` +
        `🎨 *Orçamento de sites e templates*\n` +
        `📅 *Agendamento de atendimento*\n` +
        `💬 *Tirar dúvidas sobre nossos serviços*\n\n` +
        `Digite *"orçamento"* para começarmos!`;
      
      await this.sendMessage(userPhone, welcomeMessage);
      
    } else {
      // Resposta inteligente com Gemini
      const aiResponse = await generateResponse(userMessage, contactName);
      await this.sendMessage(userPhone, aiResponse);
    }
  }

  async handleBudgetOption(userPhone, userMessage, message, userInfo) {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('1') || lowerMessage.includes('escolher') || lowerMessage.includes('modelo')) {
      await this.sendMessage(userPhone, 'Entendi! Olhe a lista abaixo e escolha uma das opções:');
      await this.showTemplatesCatalog(userPhone);
      
    } else if (lowerMessage.includes('2') || lowerMessage.includes('atendimento') || lowerMessage.includes('humano')) {
      await this.showScheduleOptions(userPhone);
      
    } else if (lowerMessage.includes('3') || lowerMessage.includes('projeto') || lowerMessage.includes('descrever')) {
      await this.sendMessage(userPhone, '📝 Perfeito! Por favor, descreva brevemente seu projeto:\n\n• Tipo de site necessário\n• Funcionalidades desejadas\n• Prazo estimado\n\nEnviaremos um orçamento personalizado! 🚀');
      this.userStates.set(userPhone, 'menu');
      
    } else {
      await this.sendMessage(userPhone, '❌ Por favor, escolha uma opção válida:\n\n1 - Escolher modelo de site\n2 - Atendimento humano\n3 - Descrever meu projeto');
    }
  }

  async showTemplatesCatalog(userPhone) {
    const templates = this.getTemplates();
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
    
    await this.sendMessage(userPhone, catalogMessage);
    this.userStates.set(userPhone, 'awaiting_template_selection');
  }

  async handleTemplateSelection(userPhone, userMessage, message, userInfo) {
    if (userMessage.toLowerCase() === 'voltar' || userMessage === '0') {
      await this.sendMessage(userPhone, 'Voltando ao menu principal...');
      this.userStates.set(userPhone, 'menu');
      return;
    }

    const templateNumber = parseInt(userMessage);
    const template = this.getTemplates().find(t => t.id === templateNumber);

    if (template) {
      userInfo.selectedTemplate = template;
      this.userData.set(userPhone, userInfo);
      
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
      
      await this.sendMessage(userPhone, templateDetails);
      this.userStates.set(userPhone, 'awaiting_payment_decision');
      
    } else {
      await this.sendMessage(userPhone, '❌ Template não encontrado. Digite o número correto ou *voltar* para o menu.');
    }
  }

  async handlePaymentDecision(userPhone, userMessage, message, userInfo) {
    const template = userInfo.selectedTemplate;
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('1') || lowerMessage.includes('pagar') || lowerMessage.includes('comprar')) {
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
      
      await this.sendMessage(userPhone, pixMessage);
      this.userStates.set(userPhone, 'menu');
      
    } else if (lowerMessage.includes('2') || lowerMessage.includes('agendar') || lowerMessage.includes('atendimento')) {
      await this.showScheduleOptions(userPhone);
      
    } else if (lowerMessage.includes('3') || lowerMessage.includes('mais') || lowerMessage.includes('templates')) {
      await this.showTemplatesCatalog(userPhone);
      
    } else if (lowerMessage.includes('4') || lowerMessage.includes('voltar')) {
      await this.sendMessage(userPhone, 'Voltando ao menu principal...');
      this.userStates.set(userPhone, 'menu');
      
    } else {
      await this.sendMessage(userPhone, '❌ Por favor, escolha uma opção válida (1, 2, 3 ou 4).');
    }
  }

  async showScheduleOptions(userPhone) {
    const availableSlots = this.getAvailableSlots();
    let scheduleMessage = `📅 *AGENDAMENTO DE ATENDIMENTO*\n\n` +
      `Escolha um horário disponível para nosso atendimento:\n\n`;
    
    availableSlots.forEach((slot, index) => {
      scheduleMessage += `${index + 1}. 🕐 ${slot}\n`;
    });
    
    scheduleMessage += `\n💡 *INSTRUÇÕES:*\n`;
    scheduleMessage += `Digite o *NÚMERO* do horário desejado\n`;
    scheduleMessage += `Ou digite *voltar* para o menu principal`;
    
    await this.sendMessage(userPhone, scheduleMessage);
    this.userStates.set(userPhone, 'awaiting_schedule_selection');
  }

  async handleScheduleSelection(userPhone, userMessage, message, userInfo) {
    if (userMessage.toLowerCase() === 'voltar' || userMessage === '0') {
      await this.sendMessage(userPhone, 'Voltando ao menu principal...');
      this.userStates.set(userPhone, 'menu');
      return;
    }

    const slotNumber = parseInt(userMessage);
    const availableSlots = this.getAvailableSlots();
    const selectedSlot = availableSlots[slotNumber - 1];

    if (selectedSlot) {
      const contact = await this.client.getContactById(userPhone);
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
      
      await this.sendMessage(userPhone, confirmationMessage);
      this.userStates.set(userPhone, 'menu');
      
    } else {
      await this.sendMessage(userPhone, '❌ Horário inválido. Escolha um número da lista ou digite *voltar*.');
    }
  }

  async sendMessage(phone, message) {
    try {
      if (!this.isConnected) {
        console.error('❌ WhatsApp não está conectado');
        return false;
      }

      const sentMessage = await this.client.sendMessage(phone, message);
      await saveMessage(phone, message, 'bot');
      
      console.log(`✅ Mensagem enviada para ${phone}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return false;
    }
  }

  getTemplates() {
    // Templates em memória - pode ser substituído por banco de dados
    return [
      {
        id: 1,
        name: "Site Institucional Premium",
        description: "Site profissional completo com 5 páginas, design responsivo e SEO otimizado",
        price: "497.00",
        category: "Institucional",
        features: ["5 páginas", "Design responsivo", "Formulário de contato", "SEO básico"],
        delivery: "3-5 dias"
      },
      // ... outros templates
    ];
  }

  getAvailableSlots() {
    // Horários disponíveis (13h às 23h)
    const slots = [];
    for (let hour = 13; hour <= 23; hour++) {
      slots.push(`${hour}:00`);
    }
    return slots;
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      user: this.client?.info?.wid?.user || null
    };
  }

  getStatistics() {
    return {
      activeUsers: this.userStates.size,
      userStates: Object.fromEntries(this.userStates),
      userData: Object.fromEntries(this.userData)
    };
  }
}

export default new WhatsAppService();
