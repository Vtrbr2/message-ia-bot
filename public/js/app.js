// public/js/app.js

class WhatsAppBotAdmin {
  constructor() {
    this.currentTab = 'contacts';
    this.contacts = [];
    this.messages = [];
    this.schedules = [];
    this.templates = [];
    this.stats = {};
    this.autoRefreshInterval = null;
  }

  init() {
    this.setupEventListeners();
    this.loadInitialData();
    this.startAutoRefresh();
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Contact search
    document.getElementById('search-contacts')?.addEventListener('input', (e) => {
      this.filterContacts(e.target.value);
    });

    // Contact select for messages
    document.getElementById('contact-select')?.addEventListener('change', (e) => {
      this.loadMessages(e.target.value || null);
    });

    // Refresh buttons
    document.querySelectorAll('.refresh-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.refreshCurrentTab();
      });
    });

    // Export functionality
    document.getElementById('export-contacts')?.addEventListener('click', () => {
      this.exportContacts();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case '1':
            e.preventDefault();
            this.switchTab('contacts');
            break;
          case '2':
            e.preventDefault();
            this.switchTab('messages');
            break;
          case '3':
            e.preventDefault();
            this.switchTab('schedule');
            break;
          case '4':
            e.preventDefault();
            this.switchTab('reports');
            break;
          case '5':
            e.preventDefault();
            this.switchTab('templates');
            break;
          case 'r':
            e.preventDefault();
            this.refreshCurrentTab();
            break;
        }
      }
    });
  }

  async loadInitialData() {
    await Promise.all([
      this.loadStats(),
      this.loadWhatsAppStatus(),
      this.loadContacts()
    ]);
  }

  switchTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('border-blue-500', 'text-blue-600', 'bg-blue-50');
      btn.classList.add('text-gray-500', 'hover:text-blue-500');
    });
    
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    activeBtn.classList.add('border-blue-500', 'text-blue-600', 'bg-blue-50');
    activeBtn.classList.remove('text-gray-500', 'hover:text-blue-500');
    
    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    document.getElementById(`${tabName}-content`).classList.remove('hidden');
    
    this.currentTab = tabName;
    this.loadTabData(tabName);
  }

  async loadTabData(tabName) {
    this.showLoading(tabName);
    
    try {
      switch(tabName) {
        case 'contacts':
          await this.loadContacts();
          break;
        case 'messages':
          await this.loadMessages();
          break;
        case 'schedule':
          await this.loadSchedules();
          break;
        case 'reports':
          await this.loadReports();
          break;
        case 'templates':
          await this.loadTemplates();
          break;
      }
    } catch (error) {
      this.showNotification(`Erro ao carregar ${tabName}: ${error.message}`, 'error');
    } finally {
      this.hideLoading(tabName);
    }
  }

  async loadStats() {
    try {
      const response = await fetch('/api/stats');
      this.stats = await response.json();
      this.updateStatsUI();
    } catch (error) {
      console.error('Error loading stats:', error);
      this.showNotification('Erro ao carregar estatísticas', 'error');
    }
  }

  updateStatsUI() {
    const elements = {
      'total-contacts': this.stats.totalContacts || 0,
      'total-messages': this.stats.totalMessages || 0,
      'total-schedules': this.stats.totalSchedules || 0,
      'today-messages': this.stats.todayMessages || 0
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value.toLocaleString('pt-BR');
      }
    });

    // Update trends
    this.updateTrendIndicators();
  }

  updateTrendIndicators() {
    // This would compare with previous data to show trends
    // For now, we'll show simple indicators
    const indicators = document.querySelectorAll('.trend-indicator');
    indicators.forEach(indicator => {
      indicator.innerHTML = '<i class="fas fa-arrow-up text-green-500"></i>';
    });
  }

  async loadWhatsAppStatus() {
    try {
      const response = await fetch('/api/whatsapp-status');
      const status = await response.json();
      this.updateStatusUI(status);
    } catch (error) {
      console.error('Error loading WhatsApp status:', error);
      this.updateStatusUI({ connected: false, phone: null });
    }
  }

  updateStatusUI(status) {
    const statusElement = document.getElementById('whatsapp-status');
    const dot = statusElement.querySelector('.status-dot');
    const text = statusElement.querySelector('.status-text');

    if (status.connected) {
      dot.className = 'status-dot status-online';
      text.innerHTML = `<span class="font-semibold">Conectado</span><br><span class="text-sm">${status.phone}</span>`;
      statusElement.className = 'status-indicator online';
    } else {
      dot.className = 'status-dot status-offline';
      text.innerHTML = '<span class="font-semibold">Desconectado</span>';
      statusElement.className = 'status-indicator offline';
    }
  }

  async loadContacts() {
    try {
      const response = await fetch('/api/contacts');
      this.contacts = await response.json();
      this.renderContacts();
      this.updateContactSelect();
    } catch (error) {
      console.error('Error loading contacts:', error);
      this.showNotification('Erro ao carregar contatos', 'error');
    }
  }

  renderContacts() {
    const container = document.getElementById('contacts-list');
    if (!container) return;

    if (this.contacts.length === 0) {
      container.innerHTML = this.getEmptyState('contatos', 'users');
      return;
    }

    container.innerHTML = this.contacts.map(contact => `
      <tr class="hover:bg-gray-50 transition-colors" data-phone="${contact.phone}">
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <div class="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              ${this.getInitials(contact.name)}
            </div>
            <div class="ml-4">
              <div class="text-sm font-medium text-gray-900">${contact.name || 'Não informado'}</div>
              <div class="text-sm text-gray-500">${this.formatPhone(contact.phone)}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${this.formatPhone(contact.phone)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <i class="fas fa-comment mr-1"></i>
            ${contact.message_count || 0}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <div class="flex items-center">
            <i class="fas fa-clock mr-2 text-gray-400"></i>
            ${this.formatDate(contact.last_contact)}
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button onclick="admin.viewMessages('${contact.phone}')" 
                  class="text-blue-600 hover:text-blue-900 mr-3 transition-colors"
                  title="Ver mensagens">
            <i class="fas fa-eye"></i>
          </button>
          <button onclick="admin.exportContact('${contact.phone}')" 
                  class="text-green-600 hover:text-green-900 transition-colors"
                  title="Exportar contato">
            <i class="fas fa-download"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  async loadMessages(phone = null) {
    try {
      const url = phone ? `/api/messages?phone=${encodeURIComponent(phone)}` : '/api/messages';
      const response = await fetch(url);
      this.messages = await response.json();
      this.renderMessages();
    } catch (error) {
      console.error('Error loading messages:', error);
      this.showNotification('Erro ao carregar mensagens', 'error');
    }
  }

  renderMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    if (this.messages.length === 0) {
      container.innerHTML = this.getEmptyState('mensagens', 'comments');
      return;
    }

    container.innerHTML = this.messages.map(message => `
      <div class="message-bubble ${message.sender === 'user' ? 'user' : 'bot'} p-4 mb-3">
        <div class="flex justify-between items-start mb-2">
          <span class="font-semibold text-sm ${message.sender === 'user' ? 'text-green-700' : 'text-blue-700'}">
            ${message.sender === 'user' ? '👤 ' + (message.name || 'Cliente') : '🤖 Bot'}
          </span>
          <span class="text-xs text-gray-500">
            ${this.formatDateTime(message.timestamp)}
          </span>
        </div>
        <div class="text-gray-700 whitespace-pre-wrap text-sm">${this.escapeHtml(message.message)}</div>
      </div>
    `).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  async loadSchedules() {
    try {
      const response = await fetch('/api/schedules');
      this.schedules = await response.json();
      this.renderSchedules();
    } catch (error) {
      console.error('Error loading schedules:', error);
      this.showNotification('Erro ao carregar agendamentos', 'error');
    }
  }

  renderSchedules() {
    const container = document.getElementById('schedules-list');
    if (!container) return;

    if (this.schedules.length === 0) {
      container.innerHTML = this.getEmptyState('agendamentos', 'calendar');
      return;
    }

    container.innerHTML = this.schedules.map(schedule => {
      const scheduleDate = new Date(schedule.schedule_date);
      const isToday = this.isToday(scheduleDate);
      const isPast = this.isPast(scheduleDate);
      
      return `
        <div class="bg-white rounded-lg border ${isToday ? 'border-yellow-200 bg-yellow-50' : isPast ? 'border-gray-200' : 'border-green-200'} p-4 transition-all hover:shadow-md">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="flex items-center mb-2">
                <div class="flex-shrink-0 h-10 w-10 bg-${isToday ? 'yellow' : isPast ? 'gray' : 'green'}-100 rounded-full flex items-center justify-center">
                  <i class="fas fa-calendar text-${isToday ? 'yellow' : isPast ? 'gray' : 'green'}-600 text-sm"></i>
                </div>
                <div class="ml-3">
                  <h4 class="font-semibold text-gray-900">${schedule.name}</h4>
                  <p class="text-gray-600 text-sm">${schedule.phone}</p>
                </div>
              </div>
              
              <div class="flex items-center space-x-4 text-sm mt-3">
                <span class="flex items-center text-gray-500">
                  <i class="fas fa-calendar-day mr-2"></i>
                  ${scheduleDate.toLocaleDateString('pt-BR')}
                </span>
                <span class="flex items-center font-semibold ${isToday ? 'text-yellow-600' : isPast ? 'text-gray-600' : 'text-green-600'}">
                  <i class="fas fa-clock mr-2"></i>
                  ${schedule.schedule_time}
                </span>
              </div>
            </div>
            
            <div class="text-right">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                isToday ? 'bg-yellow-100 text-yellow-800' : 
                isPast ? 'bg-gray-100 text-gray-800' : 
                'bg-green-100 text-green-800'
              }">
                <i class="fas ${isToday ? 'fa-exclamation-circle' : isPast ? 'fa-check-circle' : 'fa-clock'} mr-1"></i>
                ${isToday ? 'Hoje' : isPast ? 'Concluído' : 'Agendado'}
              </span>
              <p class="text-xs text-gray-500 mt-2">
                Criado: ${this.formatDateTime(schedule.created_at)}
              </p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async loadReports() {
    try {
      await this.loadStats();
      this.renderReports();
      this.renderCharts();
    } catch (error) {
      console.error('Error loading reports:', error);
      this.showNotification('Erro ao carregar relatórios', 'error');
    }
  }

  renderReports() {
    const container = document.getElementById('reports-stats');
    if (!container) return;

    const responseRate = this.stats.totalContacts > 0 ? 
      Math.round((this.stats.todayMessages / this.stats.totalContacts) * 100) : 0;
    
    const avgMessages = Math.round(this.stats.totalMessages / 30);

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex justify-between items-center py-3 border-b border-gray-200">
          <div class="flex items-center">
            <i class="fas fa-reply text-blue-500 mr-3"></i>
            <span class="text-gray-600">Taxa de resposta</span>
          </div>
          <span class="font-semibold text-lg ${responseRate > 50 ? 'text-green-600' : 'text-yellow-600'}">
            ${responseRate}%
          </span>
        </div>
        
        <div class="flex justify-between items-center py-3 border-b border-gray-200">
          <div class="flex items-center">
            <i class="fas fa-chart-line text-purple-500 mr-3"></i>
            <span class="text-gray-600">Média mensagens/dia</span>
          </div>
          <span class="font-semibold text-lg">${avgMessages}</span>
        </div>
        
        <div class="flex justify-between items-center py-3 border-b border-gray-200">
          <div class="flex items-center">
            <i class="fas fa-calendar-check text-green-500 mr-3"></i>
            <span class="text-gray-600">Agendamentos ativos</span>
          </div>
          <span class="font-semibold text-lg text-blue-600">${this.stats.totalSchedules}</span>
        </div>
        
        <div class="flex justify-between items-center py-3">
          <div class="flex items-center">
            <i class="fas fa-bolt text-orange-500 mr-3"></i>
            <span class="text-gray-600">Mensagens esta semana</span>
          </div>
          <span class="font-semibold text-lg text-purple-600">${this.stats.weekMessages || 0}</span>
        </div>
      </div>
    `;
  }

  renderCharts() {
    const ctx = document.getElementById('messagesChart');
    if (!ctx) return;

    // Simple chart implementation
    new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
        datasets: [{
          label: 'Mensagens por Dia',
          data: [this.getRandomInt(5, 20), this.getRandomInt(10, 25), this.getRandomInt(8, 18), 
                 this.getRandomInt(12, 22), this.getRandomInt(15, 30), this.getRandomInt(5, 15), this.getRandomInt(3, 12)],
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  async loadTemplates() {
    try {
      const response = await fetch('/api/templates');
      this.templates = await response.json();
      this.renderTemplates();
    } catch (error) {
      console.error('Error loading templates:', error);
      this.showNotification('Erro ao carregar templates', 'error');
    }
  }

  renderTemplates() {
    const container = document.getElementById('templates-list');
    const countElement = document.getElementById('templates-count');
    
    if (!container) return;

    if (countElement) {
      countElement.textContent = `${this.templates.length} templates disponíveis`;
    }

    if (this.templates.length === 0) {
      container.innerHTML = this.getEmptyState('templates', 'palette');
      return;
    }

    container.innerHTML = this.templates.map(template => `
      <div class="bg-white rounded-xl shadow-md overflow-hidden card-hover">
        <div class="p-4 border-b border-gray-200">
          <div class="flex justify-between items-start mb-2">
            <h4 class="font-semibold text-lg text-gray-800">${template.name}</h4>
            <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
              ${template.category}
            </span>
          </div>
          <p class="text-gray-600 text-sm line-clamp-2">${template.description}</p>
        </div>
        
        <div class="p-4">
          <div class="flex justify-between items-center mb-3">
            <span class="text-2xl font-bold text-green-600">R$ ${template.price}</span>
            <span class="text-sm text-gray-500">
              <i class="fas fa-clock mr-1"></i>${template.delivery}
            </span>
          </div>
          
          <div class="space-y-2 mb-4">
            ${template.features.slice(0, 3).map(feature => `
              <div class="flex items-center text-sm text-gray-600">
                <i class="fas fa-check-circle text-green-500 mr-2"></i>
                ${feature}
              </div>
            `).join('')}
          </div>
          
          <div class="flex space-x-2">
            <button class="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors">
              <i class="fas fa-shopping-cart mr-1"></i>Usar
            </button>
            <button class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-3 rounded-lg transition-colors">
              <i class="fas fa-eye mr-1"></i>Ver
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Utility methods
  getInitials(name) {
    if (!name) return 'C';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  formatPhone(phone) {
    if (!phone) return '';
    // Remove non-numeric characters and format
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 12) {
      return `+${cleaned.substring(0, 2)} (${cleaned.substring(2, 4)}) ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`;
    }
    return phone;
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  }

  formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR');
  }

  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  isPast(date) {
    return date < new Date();
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getEmptyState(type, icon) {
    return `
      <div class="text-center py-12 text-gray-500">
        <i class="fas fa-${icon} text-4xl mb-4 text-gray-300"></i>
        <p class="text-lg font-medium">Nenhum ${type} encontrado</p>
        <p class="text-sm mt-2">Quando houver ${type}, eles aparecerão aqui.</p>
      </div>
    `;
  }

  showLoading(tab) {
    const container = document.getElementById(`${tab}-content`);
    if (container) {
      container.classList.add('loading');
    }
  }

  hideLoading(tab) {
    const container = document.getElementById(`${tab}-content`);
    if (container) {
      container.classList.remove('loading');
    }
  }

  showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(notif => notif.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="flex items-center">
        <i class="fas fa-${this.getNotificationIcon(type)} mr-2"></i>
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  getNotificationIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle'
    };
    return icons[type] || 'info-circle';
  }

  updateContactSelect() {
    const select = document.getElementById('contact-select');
    if (!select) return;

    select.innerHTML = '<option value="">Todos os contatos</option>';
    this.contacts.forEach(contact => {
      const option = document.createElement('option');
      option.value = contact.phone;
      option.textContent = `${contact.name || 'Cliente'} - ${this.formatPhone(contact.phone)}`;
      select.appendChild(option);
    });
  }

  filterContacts(searchTerm) {
    if (!searchTerm) {
      this.renderContacts();
      return;
    }

    const filtered = this.contacts.filter(contact => 
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone.includes(searchTerm)
    );

    const container = document.getElementById('contacts-list');
    if (container) {
      // Temporary implementation - in real app, we'd re-render
      container.querySelectorAll('tr').forEach(row => {
        const phone = row.dataset.phone;
        const contact = this.contacts.find(c => c.phone === phone);
        const shouldShow = contact && (
          contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.phone.includes(searchTerm)
        );
        row.style.display = shouldShow ? '' : 'none';
      });
    }
  }

  viewMessages(phone) {
    this.switchTab('messages');
    const select = document.getElementById('contact-select');
    if (select) {
      select.value = phone;
      this.loadMessages(phone);
    }
  }

  exportContact(phone) {
    const contact = this.contacts.find(c => c.phone === phone);
    if (contact) {
      const data = JSON.stringify(contact, null, 2);
      this.downloadFile(data, `contato-${phone}.json`, 'application/json');
      this.showNotification('Contato exportado com sucesso!', 'success');
    }
  }

  exportContacts() {
    const data = JSON.stringify(this.contacts, null, 2);
    this.downloadFile(data, `contatos-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    this.showNotification('Contatos exportados com sucesso!', 'success');
  }

  downloadFile(data, filename, type) {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  refreshCurrentTab() {
    this.loadTabData(this.currentTab);
    this.showNotification('Dados atualizados!', 'success');
  }

  startAutoRefresh() {
    // Refresh data every 30 seconds
    this.autoRefreshInterval = setInterval(() => {
      this.loadStats();
      this.loadWhatsAppStatus();
      
      if (this.currentTab === 'contacts') this.loadContacts();
      else if (this.currentTab === 'messages') this.loadMessages();
      else if (this.currentTab === 'schedule') this.loadSchedules();
    }, 30000);
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
  }
}

// Initialize the admin when DOM is loaded
const admin = new WhatsAppBotAdmin();
document.addEventListener('DOMContentLoaded', () => {
  admin.init();
});

// Make admin available globally for onclick handlers
window.admin = admin;
