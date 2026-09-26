import { Router } from 'express';
import { signatureVerifier, initSessionTable } from '../services/line/config.js';
import { handleEvent } from '../services/line/eventHandler.js';

// Auto-initialize line_chat_sessions table
initSessionTable();

export const lineRouter = Router();

// Router Webhook listener
lineRouter.post('/webhook', signatureVerifier, (req, res) => {
  const events = req.body.events;
  // Acknowledge LINE immediately with 200 OK to prevent LINE webhook timeout and retries
  res.status(200).send('OK');

  if (!events || !Array.isArray(events)) {
    return;
  }

  // Handle events asynchronously
  Promise.all(events.map(handleEvent)).catch(error => {
    console.error('Error in LINE webhook background processing:', error);
  });
});

// Re-export services needed by external modules (e.g. orders.js)
export { notifyAdminNewOrder } from '../services/line/notifications/adminNotifier.js';
export { notifyCustomerOrderStatus } from '../services/line/notifications/customerNotifier.js';
export { extractOrderIntent } from '../services/line/parsers/orderIntent.js';
