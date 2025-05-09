const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const paypal = require('@paypal/checkout-server-sdk');
const sgMail = require('@sendgrid/mail');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

dotenv.config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// PayPal Client
const paypalClient = new paypal.core.PayPalHttpClient(
  new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_SECRET
  )
);

const app = express();
app.use(cors());
app.use(express.json());

// Statische Dateien (für PDFs)
app.use('/invoices', express.static(path.join(__dirname, 'invoices')));

// API-Endpunkte

// Bestellung erstellen
app.post('/api/orders', async (req, res) => {
  try {
    const { items, customer, shippingAddress, total, paypalTransactionId } = req.body;
    const orderId = `order_${Date.now()}`;

    // PayPal Transaktion verifizieren
    const request = new paypal.orders.OrdersGetRequest(paypalTransactionId);
    const paypalOrder = await paypalClient.execute(request);
    if (paypalOrder.result.status !== 'COMPLETED') {
      throw new Error('PayPal-Zahlung nicht abgeschlossen');
    }

    // Gelato-API Integration
    const gelatoOrder = await axios.post(
      'https://api.gelato.com/v1/orders',
      {
        order_reference_id: orderId,
        items: items.map(item => ({
          product_uid: item.gelatoId,
          quantity: 1,
        })),
        shipping_address: {
          first_name: customer.name.split(' ')[0],
          last_name: customer.name.split(' ').slice(1).join(' '),
          address_line_1: shippingAddress.street,
          city: shippingAddress.city,
          postcode: shippingAddress.postal,
          country: shippingAddress.country,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GELATO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // E-Mail senden
    const msg = {
      to: customer.email,
      from: 'your-email@example.com', // Ersetzen Sie mit Ihrer verifizierten E-Mail
      subject: `Bestellbestätigung ${orderId}`,
      html: `
        <div style="background-color: #0A0B1A; color: #E2E8F0; padding: 20px; font-family: 'Poppins', sans-serif;">
          <h2 style="color: #00D4FF;">Bestellbestätigung</h2>
          <p>Bestell-ID: ${orderId}</p>
          <p>Kunde: ${customer.name}</p>
          <p>Adresse: ${shippingAddress.street}, ${shippingAddress.city}, ${shippingAddress.postal}, ${shippingAddress.country}</p>
          <p>Artikel:</p>
          <ul>
            ${items.map(item => `<li>${item.name} - $${item.price.toFixed(2)}</li>`).join('')}
          </ul>
          <p>Gesamt: $${total.toFixed(2)}</p>
          <p>Danke für Ihre Bestellung!</p>
        </div>
      `,
    };
    await sgMail.send(msg);

    // PDF generieren
    const doc = new PDFDocument();
    const pdfPath = path.join(__dirname, `invoices/invoice_${orderId}.pdf`);
    doc.pipe(fs.createWriteStream(pdfPath));
    doc.fontSize(16).text(`Bestellbestätigung ${orderId}`, { align: 'center' });
    doc.fontSize(12).text(`Kunde: ${customer.name} (${customer.email})`);
    doc.text(`Adresse: ${shippingAddress.street}, ${shippingAddress.city}, ${shippingAddress.postal}, ${shippingAddress.country}`);
    doc.text('Artikel:');
    items.forEach(item => {
      doc.text(`- ${item.name}: $${item.price.toFixed(2)}`);
    });
    doc.text(`Gesamt: $${total.toFixed(2)}`);
    doc.end();

    res.json({ success: true, orderId, pdfPath: `/invoices/invoice_${orderId}.pdf` });
  } catch (err) {
    console.error('Bestellfehler:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen der Bestellung' });
  }
});

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
