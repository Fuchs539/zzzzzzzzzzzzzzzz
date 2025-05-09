var gk_isXlsx = false;
var gk_xlsxFileLookup = {};
var gk_fileData = {};
function filledCell(cell) {
  return cell !== '' && cell != null;
}
function loadFileData(filename) {
  if (gk_isXlsx && gk_xlsxFileLookup[filename]) {
    try {
      var workbook = XLSX.read(gk_fileData[filename], { type: 'base64' });
      var firstSheetName = workbook.SheetNames[0];
      var worksheet = workbook.Sheets[firstSheetName];
      var jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: '' });
      var filteredData = jsonData.filter(row => row.some(filledCell));
      var headerRowIndex = filteredData.findIndex((row, index) =>
        row.filter(filledCell).length >= filteredData[index + 1]?.filter(filledCell).length
      );
      if (headerRowIndex === -1 || headerRowIndex > 25) {
        headerRowIndex = 0;
      }
      var csv = XLSX.utils.aoa_to_sheet(filteredData.slice(headerRowIndex));
      csv = XLSX.utils.sheet_to_csv(csv, { header: 1 });
      return csv;
    } catch (e) {
      console.error(e);
      return "";
    }
  }
  return gk_fileData[filename] || "";
}

let cart = [];
let orders = [];
let isAdmin = false;
let isLoggedIn = false;
let analytics = { daily: 0, monthly: 0, total: 0 };
let products = [
  { gelatoId: 'gelato_001', name: 'Hoodie Fuchs', price: 39.99, image: 'https://via.placeholder.com/150?text=Hoodie+Fuchs', category: 'Kleidung' },
  { gelatoId: 'gelato_002', name: 'T-Shirt', price: 19.99, image: 'https://via.placeholder.com/150?text=T-Shirt', category: 'Kleidung' },
];

window.onload = function() {
  loadSettings();
  loadProducts();
  updateOrders();
  updateAnalytics();
  togglePayoutFields();
  updateCategoryFilter();
  populateMonthlyPayoutDays();

  // PayPal-Button initialisieren
  paypal.Buttons({
    createOrder: function(data, actions) {
      const total = cart.reduce((sum, item) => sum + item.price, 0);
      return actions.order.create({
        purchase_units: [{
          amount: {
            value: total.toFixed(2),
            currency_code: 'USD'
          }
        }]
      });
    },
    onApprove: function(data, actions) {
      return actions.order.capture().then(function(details) {
        checkout(details);
      });
    },
    onError: function(err) {
      console.error('PayPal Fehler:', err);
      alert('Zahlung fehlgeschlagen. Bitte versuchen Sie es erneut.');
    }
  }).render('#paypal-button-container');
};

window.addEventListener('pageshow', function(event) {
  if (event.persisted) {
    loadSettings();
    loadProducts();
    updateOrders();
    updateAnalytics();
    togglePayoutFields();
    updateCategoryFilter();
    populateMonthlyPayoutDays();
  }
});

function populateMonthlyPayoutDays() {
  const payoutDayOfMonth = document.getElementById('payoutDayOfMonth');
  payoutDayOfMonth.innerHTML = '';
  for (let i = 1; i <= 31; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    payoutDayOfMonth.appendChild(option);
  }
}

function showModal(id) {
  document.getElementById(id).style.display = 'flex';
  if (id === 'checkoutModal') {
    updateCartDisplay();
  }
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function showLegalModal(type) {
  const contentId = `${type}Content`;
  const inputId = `${type}Input`;
  const contentElement = document.getElementById(contentId);
  const inputElement = document.getElementById(inputId);
  contentElement.textContent = inputElement.value || 'Kein Inhalt verfügbar.';
  showModal(`${type}Modal`);
}

function updateLegalContent(type) {
  const contentId = `${type}Content`;
  const inputId = `${type}Input`;
  const contentElement = document.getElementById(contentId);
  const inputElement = document.getElementById(inputId);
  contentElement.textContent = inputElement.value || 'Kein Inhalt verfügbar.';
  updateSettings('legal');
}

function toggleAccordion(header) {
  const content = header.nextElementSibling;
  const allContents = document.querySelectorAll('#adminDashboard .accordion-content');
  allContents.forEach(item => {
    if (item !== content) {
      item.classList.remove('active');
    }
  });
  content.classList.toggle('active');
}

function login() {
  const email = document.getElementById('loginEmail').value;
  if (email) {
    isLoggedIn = true;
    alert(`Angemeldet als ${email}`);
    updateHeaderButtons();
    closeModal('loginModal');
  } else {
    alert('Bitte geben Sie eine E-Mail-Adresse ein');
  }
}

function adminLogin() {
  const key = document.getElementById('adminKey').value;
  if (key === '12345') {
    isAdmin = true;
    isLoggedIn = true;
    alert('Admin angemeldet');
    updateHeaderButtons();
    closeModal('adminLoginModal');
  } else {
    alert('Ungültiger Admin-Schlüssel');
  }
}

function updateHeaderButtons() {
  const buttons = document.getElementById('headerButtons');
  buttons.innerHTML = `
    <button onclick="showModal('loginModal')">${isLoggedIn ? 'Abmelden' : 'Anmelden'}</button>
    <button onclick="showModal('checkoutModal')" id="cartButton">Warenkorb (${cart.length})</button>
    ${isAdmin ? '<button onclick="showModal(\'adminDashboard\')"><svg style="width: 20px; height: 20px; display: inline; margin-right: 4px;" fill="none" stroke="#E2E8F0" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.389-1.756 2.815 0 .398 1.638-.936 3.183-2.815 3.183-1.879 0-3.213-1.545-2.815-3.183zM9 12h6m-3-3v6m5 5H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2z" /></svg>Einstellungen</button>' : ''}
  `;
}

function togglePayoutFields() {
  const frequency = document.getElementById('payoutFrequency').value;
  document.getElementById('weeklyPayoutFields').style.display = frequency === 'weekly' ? 'block' : 'none';
  document.getElementById('monthlyPayoutFields').style.display = frequency === 'monthly' ? 'block' : 'none';
}

function updateSettings(section) {
  let settings = {
    general: {},
    apiKeys: {},
    payout: {},
    legal: {},
    products: products
  };

  if (section === 'general') {
    settings.general = {
      shopName: document.getElementById('shopNameInput').value,
      bannerUrl: document.getElementById('bannerInput').value,
      phone: document.getElementById('phoneInput').value,
      hours: document.getElementById('hoursInput').value,
      footerText: document.getElementById('footerTextInput').value,
      youtube: document.getElementById('youtubeInput').value,
      tiktok: document.getElementById('tiktokInput').value,
      instagram: document.getElementById('instagramInput').value,
      showCategories: document.getElementById('showCategories').checked,
    };

    document.getElementById('shopName').textContent = settings.general.shopName;
    document.getElementById('banner').style.background = `url('${settings.general.bannerUrl}') center/cover no-repeat`;
    document.getElementById('supportInfo').textContent = `${settings.general.phone} | ${settings.general.hours}`;
    document.getElementById('footerText').textContent = settings.general.footerText;
    document.getElementById('socialLinks').innerHTML = `
      <a href="${settings.general.youtube}">YouTube</a>
      <a href="${settings.general.tiktok}">TikTok</a>
      <a href="${settings.general.instagram}">Instagram</a>
    `;
  } else if (section === 'apiKeys') {
    settings.apiKeys = {
      gelatoApi: document.getElementById('gelatoApiInput').value,
    };
  } else if (section === 'payout') {
    settings.payout = {
      payoutIban: document.getElementById('payoutIban').value,
      payoutBic: document.getElementById('payoutBic').value,
      payoutFrequency: document.getElementById('payoutFrequency').value,
      payoutDayOfWeek: document.getElementById('payoutDayOfWeek').value,
      payoutDayOfMonth: document.getElementById('payoutDayOfMonth').value,
    };
  } else if (section === 'legal') {
    settings.legal = {
      agb: document.getElementById('agbInput').value,
      impressum: document.getElementById('impressumInput').value,
      datenschutz: document.getElementById('datenschutzInput').value,
      widerrufsrecht: document.getElementById('widerrufsrechtInput').value,
    };
  }

  localStorage.setItem('shopSettings', JSON.stringify(settings));

  const settingsString = JSON.stringify(settings);
  const encodedSettings = btoa(settingsString);
  const newUrl = `${window.location.pathname}?settings=${encodedSettings}`;
  window.history.replaceState(null, '', newUrl);

  updateCategoryFilter();
  filterProducts(document.querySelector('header select').value);
}

function loadSettings() {
  const localSettings = localStorage.getItem('shopSettings');
  let settings = {
    general: {
      shopName: 'Mein Online-Shop',
      bannerUrl: 'https://via.placeholder.com/1200x200/0A0B1A/6B46C1?text=Shop+Banner',
      phone: '+1234567890',
      hours: 'Mo-Fr, 9:00-14:00',
      footerText: 'Alle Rechte vorbehalten',
      youtube: 'https://youtube.com',
      tiktok: 'https://tiktok.com',
      instagram: 'https://instagram.com',
      showCategories: true,
    },
    apiKeys: {},
    payout: {
      payoutFrequency: 'weekly',
      payoutDayOfWeek: 'Friday',
      payoutDayOfMonth: '1',
    },
    legal: {},
    products: products
  };

  if (localSettings) {
    try {
      settings = JSON.parse(localSettings);
      products = settings.products || products;
    } catch (e) {
      console.error('Fehler beim Laden der Einstellungen aus localStorage:', e);
    }
  }

  document.getElementById('shopNameInput').value = settings.general.shopName;
  document.getElementById('bannerInput').value = settings.general.bannerUrl;
  document.getElementById('phoneInput').value = settings.general.phone;
  document.getElementById('hoursInput').value = settings.general.hours;
  document.getElementById('footerTextInput').value = settings.general.footerText;
  document.getElementById('youtubeInput').value = settings.general.youtube;
  document.getElementById('tiktokInput').value = settings.general.tiktok;
  document.getElementById('instagramInput').value = settings.general.instagram;
  document.getElementById('showCategories').checked = settings.general.showCategories;

  document.getElementById('shopName').textContent = settings.general.shopName;
  document.getElementById('banner').style.background = `url('${settings.general.bannerUrl}') center/cover no-repeat`;
  document.getElementById('supportInfo').textContent = `${settings.general.phone} | ${settings.general.hours}`;
  document.getElementById('footerText').textContent = settings.general.footerText;
  document.getElementById('socialLinks').innerHTML = `
    <a href="${settings.general.youtube}">YouTube</a>
    <a href="${settings.general.tiktok}">TikTok</a>
    <a href="${settings.general.instagram}">Instagram</a>
  `;

  document.getElementById('gelatoApiInput').value = settings.apiKeys.gelatoApi || '';

  document.getElementById('payoutIban').value = settings.payout.payoutIban || '';
  document.getElementById('payoutBic').value = settings.payout.payoutBic || '';
  document.getElementById('payoutFrequency').value = settings.payout.payoutFrequency || 'weekly';
  document.getElementById('payoutDayOfWeek').value = settings.payout.payoutDayOfWeek || 'Friday';
  document.getElementById('payoutDayOfMonth').value = settings.payout.payoutDayOfMonth || '1';

  document.getElementById('agbInput').value = settings.legal.agb || '';
  document.getElementById('impressumInput').value = settings.legal.impressum || '';
  document.getElementById('datenschutzInput').value = settings.legal.datenschutz || '';
  document.getElementById('widerrufsrechtInput').value = settings.legal.widerrufsrecht || '';
}

function copySettingsLink() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    alert('Link wurde in die Zwischenablage kopiert! Sie können ihn jetzt teilen.');
  }).catch(err => {
    alert('Fehler beim Kopieren des Links: ' + err);
  });
}

function updateCategoryFilter() {
  const categoryFilter = document.getElementById('categoryFilter');
  categoryFilter.innerHTML = '<option value="All">Alle</option>';

  const uniqueCategories = [...new Set(products.map(product => product.category).filter(category => category && category.trim() !== ''))];
  
  uniqueCategories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

function addProduct() {
  const templates = document.getElementById('productTemplates');
  if (templates.children.length >= 20) {
    alert('Maximal 20 Produkte erlaubt.');
    return;
  }
  const newProduct = document.createElement('div');
  newProduct.style.marginBottom = '1rem';
  newProduct.innerHTML = `
    <label>Gelato-Vorlagen-ID</label>
    <input type="text" value="gelato_${Date.now()}" onchange="updateProducts()">
    <label>Produktname</label>
    <input type="text" value="Neues Produkt" onchange="updateProducts()">
    <label>Kategorie</label>
    <input type="text" placeholder="Kategorie eingeben" onchange="updateProducts()">
    <label>Preis</label>
    <input type="number" value="0.00" onchange="updateProducts()">
    <label>Bild-URL</label>
    <input type="text" value="https://via.placeholder.com/150?text=Neues+Produkt" onchange="updateProducts()">
    <button onclick="removeProduct(this)" style="background-color: #FF4D4D;">Entfernen</button>
  `;
  templates.appendChild(newProduct);
  updateProducts();
}

function removeProduct(button) {
  button.parentElement.remove();
  updateProducts();
}

function updateProducts() {
  const templates = document.getElementById('productTemplates').children;
  products = Array.from(templates).map(template => ({
    gelatoId: template.children[1].value,
    name: template.children[3].value,
    category: template.children[5].value,
    price: parseFloat(template.children[7].value),
    image: template.children[9].value,
  }));
  updateSettings('products');
}

function loadProducts() {
  const templates = document.getElementById('productTemplates');
  templates.innerHTML = '';
  products.forEach(product => {
    const productDiv = document.createElement('div');
    productDiv.style.marginBottom = '1rem';
    productDiv.innerHTML = `
      <label>Gelato-Vorlagen-ID</label>
      <input type="text" value="${product.gelatoId}" onchange="updateProducts()">
      <label>Produktname</label>
      <input type="text" value="${product.name}" onchange="updateProducts()">
      <label>Kategorie</label>
      <input type="text" value="${product.category}" placeholder="Kategorie eingeben" onchange="updateProducts()">
      <label>Preis</label>
      <input type="number" value="${product.price}" onchange="updateProducts()">
      <label>Bild-URL</label>
      <input type="text" value="${product.image}" onchange="updateProducts()">
      <button onclick="removeProduct(this)" style="background-color: #FF4D4D;">Entfernen</button>
    `;
    templates.appendChild(productDiv);
  });

  updateCategoryFilter();
  filterProducts(document.querySelector('header select').value);
}

function addToCart(name, price, gelatoId) {
  cart.push({ name, price, gelatoId });
  updateCartCount();
  alert(`${name} wurde zum Warenkorb hinzugefügt`);
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartCount();
  updateCartDisplay();
}

function updateCartCount() {
  document.getElementById('cartButton').textContent = `Warenkorb (${cart.length})`;
}

function updateCartDisplay() {
  const cartItems = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');
  cartItems.innerHTML = '';
  if (cart.length === 0) {
    cartItems.innerHTML = '<p>Ihr Warenkorb ist leer.</p>';
    cartTotal.textContent = '';
    return;
  }
  cart.forEach((item, index) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'cart-item';
    itemElement.innerHTML = `
      <span>${item.name} - $${item.price.toFixed(2)}</span>
      <button onclick="removeFromCart(${index})">Entfernen</button>
    `;
    cartItems.appendChild(itemElement);
  });
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  cartTotal.textContent = `Gesamt: $${total.toFixed(2)}`;
}

function getLastFridayBeforeDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  let dayOfWeek = date.getDay();
  if (dayOfWeek !== 5) {
    const daysToSubtract = (dayOfWeek < 5 ? dayOfWeek + 2 : dayOfWeek - 5);
    date.setDate(day - daysToSubtract);
  }
  return date.getDate();
}

function simulateNextPayoutDate(frequency, dayOfWeek, dayOfMonth) {
  const today = new Date();
  let nextPayoutDate = new Date(today);

  if (frequency === 'weekly') {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayIndex = daysOfWeek.indexOf(dayOfWeek);
    const currentDayIndex = today.getDay();

    let daysUntilNext = (targetDayIndex - currentDayIndex + 7) % 7;
    if (daysUntilNext === 0) daysUntilNext = 7;
    nextPayoutDate.setDate(today.getDate() + daysUntilNext);
  } else if (frequency === 'monthly') {
    const targetDay = parseInt(dayOfMonth);
    nextPayoutDate = new Date(today.getFullYear(), today.getMonth(), targetDay);

    if (nextPayoutDate < today) {
      nextPayoutDate.setMonth(nextPayoutDate.getMonth() + 1);
    }

    const year = nextPayoutDate.getFullYear();
    const month = nextPayoutDate.getMonth() + 1;
    const lastFriday = getLastFridayBeforeDate(year, month, targetDay);
    nextPayoutDate.setDate(lastFriday);
  }

  return nextPayoutDate.toISOString().split('T')[0];
}

async function checkout(paypalDetails) {
  if (cart.length === 0) {
    alert('Ihr Warenkorb ist leer. Bitte fügen Sie Artikel hinzu, bevor Sie zur Kasse gehen.');
    return;
  }

  const email = document.getElementById('checkoutEmail').value;
  const name = document.getElementById('checkoutName').value;
  const street = document.getElementById('checkoutStreet').value;
  const city = document.getElementById('checkoutCity').value;
  const postal = document.getElementById('checkoutPostal').value;
  const country = document.getElementById('checkoutCountry').value;

  if (!email || !name || !street || !city || !postal || !country) {
    alert('Bitte füllen Sie alle Felder aus');
    return;
  }

  const address = { street, city, postal, country };
  const total = cart.reduce((sum, item) => sum + item.price, 0);

  const iban = document.getElementById('payoutIban').value;
  const bic = document.getElementById('payoutBic').value;
  const frequency = document.getElementById('payoutFrequency').value;
  const dayOfWeek = document.getElementById('payoutDayOfWeek').value;
  const dayOfMonth = document.getElementById('payoutDayOfMonth').value;

  if (!iban || !bic) {
    alert('Bitte geben Sie IBAN und BIC im Admin-Dashboard unter Auszahlungseinstellungen ein.');
    return;
  }

  try {
    const order = {
      id: `order_${Date.now()}`,
      items: cart,
      customer: { email, name },
      shippingAddress: address,
      total,
      paypalTransactionId: paypalDetails.id
    };

    const response = await fetch('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    const orderData = await response.json();

    if (orderData.success) {
      orders.push(order);
      updateOrders();

      analytics.daily += total;
      analytics.monthly += total;
      analytics.total += total;
      updateAnalytics();

      alert(`Bestellung erfolgreich! Bestell-ID: ${orderData.orderId}`);
      window.location.href = orderData.pdfPath; // PDF herunterladen
      cart = [];
      updateCartCount();
      updateCartDisplay();
      closeModal('checkoutModal');
    } else {
      throw new Error(orderData.error);
    }
  } catch (error) {
    console.error('Checkout-Fehler:', error);
    alert('Bestellung fehlgeschlagen. Bitte versuchen Sie es erneut.');
  }
}

function updateOrders() {
  const ordersList = document.getElementById('ordersList');
  const orderLibrary = document.getElementById('orderLibrary');
  ordersList.innerHTML = '';
  orderLibrary.innerHTML = '';
  orders.forEach(order => {
    const total = order.items.reduce((sum, item) => sum + item.price, 0);
    const orderHtml = `
      <div class="order">
        <p>Bestell-ID: ${order.id}</p>
        <p>Kunde: ${order.customer.name}</p>
        <p>Gesamt: $${total.toFixed(2)}</p>
        <button onclick="deleteOrder('${order.id}')" style="background-color: #FF4D4D;">Löschen</button>
        <button onclick="downloadOrderAsPDF('${order.id}')">PDF herunterladen</button>
      </div>
    `;
    ordersList.innerHTML += orderHtml;

    const libraryHtml = `
      <div class="order">
        <p>Bestell-ID: ${order.id}</p>
        <p>Kunde: ${order.customer.name}</p>
        <p>Adresse: ${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.postal}, ${order.shippingAddress.country}</p>
        <p>Artikel: ${order.items.map(item => `${item.name} (ID: ${item.gelatoId})`).join(', ')}</p>
        <p>Gesamt: $${total.toFixed(2)}</p>
        <button onclick="downloadOrderAsPDF('${order.id}')">Als PDF herunterladen</button>
      </div>
    `;
    orderLibrary.innerHTML += libraryHtml;
  });
}

function deleteOrder(orderId) {
  orders = orders.filter(order => order.id !== orderId);
  updateOrders();
}

function downloadOrderAsPDF(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (order) {
    window.location.href = `/invoices/invoice_${orderId}.pdf`;
  } else {
    alert('Bestellung nicht gefunden.');
  }
}

function downloadAllOrdersAsPDF() {
  alert('Alle Bestellungen als PDF herunterladen: Funktionalität erfordert serverseitige Implementierung.');
}

function updateAnalytics() {
  document.getElementById('dailyRevenue').textContent = analytics.daily.toFixed(2);
  document.getElementById('monthlyRevenue').textContent = analytics.monthly.toFixed(2);
  document.getElementById('totalRevenue').textContent = analytics.total.toFixed(2);
}

function filterProducts(category) {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';
  const showCategories = document.getElementById('showCategories')?.checked ?? true;
  products.forEach(product => {
    if (category === 'All' || product.category === category) {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <img src="${product.image}" alt="${product.name}">
        <h3>${product.name}</h3>
        <p>$${product.price.toFixed(2)}</p>
        ${showCategories ? `<p class="category">Kategorie: ${product.category}</p>` : ''}
        <button onclick="addToCart('${product.name}', ${product.price}, '${product.gelatoId}')">In den Warenkorb</button>
      `;
      grid.appendChild(card);
    }
  });
}
