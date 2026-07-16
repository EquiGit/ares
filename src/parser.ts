import { Transaction } from './types.js';

/**
 * Parses Equity Bank (Kenya) or Equitel transaction SMS text into a structured Transaction object.
 */
export function parseEquityMessage(text: string): Partial<Transaction> {
  const result: Partial<Transaction> = {
    rawMessage: text,
    parsedSuccessfully: false,
    status: 'completed',
    type: 'generic',
    currency: 'KES',
    amount: 0,
    senderName: 'Unknown Customer',
    reference: '',
    account: 'Primary Account',
    timestamp: new Date().toISOString(),
  };

  // 1. Clean reference and determine payment type
  const lowerText = text.toLowerCase();
  if (lowerText.includes('eazzypay')) {
    result.type = 'eazzypay';
  } else if (lowerText.includes('mobile transfer') || lowerText.includes('eqbk')) {
    result.type = 'mobile_transfer';
  } else if (lowerText.includes('equitel')) {
    result.type = 'equitel';
  }

  // 2. Extract Reference Code (usually 10 alphanumeric uppercase characters, e.g., OGE48FSF8S or 1234567890)
  // Let's search for "Ref: XYZ" or "Ref XYZ" or similar
  const refRegex = /(?:ref:?|reference:?|receipt:?)\s*([A-Z0-9]+)/i;
  const refMatch = text.match(refRegex);
  if (refMatch && refMatch[1]) {
    result.reference = refMatch[1].toUpperCase();
  } else {
    // Fallback: search for any standalone 10-character uppercase alphanumeric string
    const standaloneRefRegex = /\b([A-Z0-9]{10})\b/;
    const standaloneMatch = text.match(standaloneRefRegex);
    if (standaloneMatch && standaloneMatch[1]) {
      result.reference = standaloneMatch[1];
    } else {
      // Generate a temporary reference if none is found to ensure transaction is recordable
      result.reference = 'EQ' + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
  }

  // 3. Extract Amount
  // e.g. "KES 5,000.00" or "KES 500" or "USD 100"
  const amountRegex = /(?:KES|USD)\s*([0-9,]+(?:\.[0-9]{2})?)/i;
  const amountMatch = text.match(amountRegex);
  if (amountMatch && amountMatch[1]) {
    const rawAmountStr = amountMatch[1].replace(/,/g, '');
    result.amount = parseFloat(rawAmountStr);
    result.currency = text.includes('USD') ? 'USD' : 'KES';
  }

  // 4. Extract Sender Name
  // EazzyPay payment from JOHN DOE
  // Mobile Transfer from MARY JANE (254712345678)
  // received KES 350.00 from 254798765432 - PETER PAN
  let senderName = '';
  if (lowerText.includes('from')) {
    // Attempt to match names after 'from'
    // Matches "from JOHN DOE (..." or "from JOHN DOE Ref" or "from JOHN DOE on"
    const fromRegexes = [
      /from\s+([A-Za-z\s]+?)(?:\s*(?:\(|ref|to|acc|on|\d{10}))/i,
      /from\s+(\d{9,12})\s*-\s*([A-Za-z\s]+?)(?:\s*(?:\(|ref|to|acc|on|bal|$))/i, // Equitel format: from 254798765432 - PETER PAN
      /from\s+([A-Za-z\s]+?)(?:\s+$|\s+on\s+|$)/i,
    ];

    for (const regex of fromRegexes) {
      const match = text.match(regex);
      if (match) {
        // If it's the Equitel format with phone and name, name is in group 2
        if (match.length > 2 && match[2]) {
          senderName = match[2].trim();
          result.senderPhone = match[1].trim();
          break;
        } else if (match[1]) {
          senderName = match[1].trim();
          break;
        }
      }
    }
  }

  if (senderName) {
    // Clean up senderName
    // Remove trailing words like "Acc", "Ref", "Balance" if they leaked in
    senderName = senderName.replace(/\b(acc|ref|balance|bal|on|to)\b.*/i, '').trim();
    result.senderName = senderName;
  }

  // 5. Extract Sender Phone if not extracted yet
  if (!result.senderPhone) {
    const phoneRegex = /(?:254\d{9}|07\d{8}|01\d{8})/;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch) {
      result.senderPhone = phoneMatch[0];
    }
  }

  // 6. Extract Account / Till
  // e.g. "to Acc. 1234567890" or "Buy Goods Acc 600123"
  const accRegex = /(?:acc(?:\.|ount)?)\s*([0-9A-Z]+)/i;
  const accMatch = text.match(accRegex);
  if (accMatch && accMatch[1]) {
    result.account = accMatch[1].trim();
  }

  // 7. Extract Balance
  // e.g. "Balance: KES 150,000.00" or "Balance KES 12,500.00"
  const balRegex = /(?:balance:?|bal:?)\s*(?:KES|USD)?\s*([0-9,]+(?:\.[0-9]{2})?)/i;
  const balMatch = text.match(balRegex);
  if (balMatch && balMatch[1]) {
    result.balance = parseFloat(balMatch[1].replace(/,/g, ''));
  }

  // 8. Extract Date/Time
  // e.g. "on 2026-07-14 10:15:30" or "on 14/07/2026 10:15"
  const dateRegex = /on\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}|\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i;
  const dateMatch = text.match(dateRegex);
  if (dateMatch && dateMatch[1]) {
    // Try to normalize to standard date format
    try {
      const dtStr = dateMatch[1].replace(/\//g, '-'); // Simple replacement if needed
      result.timestamp = new Date(dtStr).toISOString();
    } catch {
      result.timestamp = new Date().toISOString();
    }
  } else {
    result.timestamp = new Date().toISOString();
  }

  // Mark success if we parsed an amount and reference
  if (result.amount && result.reference && result.reference !== '') {
    result.parsedSuccessfully = true;
  }

  return result;
}
