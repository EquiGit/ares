import { Transaction } from './types.js';

/**
 * Parses Equity Bank (Kenya) / M-Pesa confirmation SMS
 * into a structured Transaction object.
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

  const lowerText = text.toLowerCase();

  // --------------------------------------------------
  // Detect Transaction Type
  // --------------------------------------------------

  if (
    lowerText.includes('confirmed') &&
    lowerText.includes('received via m-pesa')
  ) {

    result.type = 'generic';

  } else if (lowerText.includes('eazzypay')) {

    result.type = 'eazzypay';

  } else if (
    lowerText.includes('mobile transfer') ||
    lowerText.includes('eqbk')
  ) {

    result.type = 'mobile_transfer';

  } else if (lowerText.includes('equitel')) {

    result.type = 'equitel';

  }

  // --------------------------------------------------
  // Reference
  // --------------------------------------------------

  const refRegex =
    /(?:ref\.?|reference:?|receipt:?)\s*([A-Z0-9]+)/i;

  const refMatch = text.match(refRegex);

  if (refMatch) {

    result.reference = refMatch[1].toUpperCase();

  } else {

    const standalone =
      text.match(/\b([A-Z0-9]{10})\b/);

    if (standalone) {

      result.reference = standalone[1];

    } else {

      result.reference =
        'EQ' +
        Math.random()
          .toString(36)
          .substring(2, 10)
          .toUpperCase();

    }

  }

  // --------------------------------------------------
  // Amount
  // --------------------------------------------------

  const amountMatch =
    text.match(/(?:KES|USD)\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i);

  if (amountMatch) {

    result.amount =
      parseFloat(amountMatch[1].replace(/,/g, ''));

    result.currency =
      lowerText.includes('usd') ? 'USD' : 'KES';

  }

// --------------------------------------------------
// Sender
// --------------------------------------------------

const newFormat = text.match(
  /from\s+(.+?)\s+Phone\s+No\.\s*(254\d{9}|07\d{8}|01\d{8})/i
);

if (newFormat) {

  result.senderName = newFormat[1]
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

  result.senderPhone = newFormat[2];

} else {

  let senderName = '';

  const senderRegexes = [

    /from\s+([A-Za-z\s]+?)(?:\s*(?:\(|ref|to|acc|on|\d{10}))/i,

    /from\s+(\d{9,12})\s*-\s*([A-Za-z\s]+?)(?:\s*(?:\(|ref|to|acc|on|bal|$))/i,

    /from\s+([A-Za-z\s]+?)(?:\s+$|\s+on\s+|$)/i,

  ];

  for (const regex of senderRegexes) {

    const match = text.match(regex);

    if (!match) continue;

    if (match.length > 2) {

      result.senderPhone = match[1].trim();
      senderName = match[2].trim();

    } else {

      senderName = match[1].trim();

    }

    break;

  }

  if (senderName) {

    result.senderName = senderName
      .replace(/\b(acc|ref|balance|bal|on|to)\b.*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

  }

}
  // --------------------------------------------------
  // Phone
  // --------------------------------------------------

  if (!result.senderPhone) {

    const phoneMatch =
      text.match(/(?:254\d{9}|07\d{8}|01\d{8})/);

    if (phoneMatch) {

      result.senderPhone = phoneMatch[0];

    }

  }

  // --------------------------------------------------
  // Account
  // --------------------------------------------------

  const accMatch =
    text.match(/(?:acc(?:\.|ount)?|buy goods acc)\s*([0-9A-Z]+)/i);

  if (accMatch) {

    result.account = accMatch[1];

  }

  // --------------------------------------------------
  // Balance
  // --------------------------------------------------

  const balMatch =
    text.match(/(?:balance:?|bal:?)\s*(?:KES|USD)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);

  if (balMatch) {

    result.balance =
      parseFloat(
        balMatch[1].replace(/,/g, '')
      );

  }

  // --------------------------------------------------
  // Date & Time
  // --------------------------------------------------

  const dateMatch = text.match(
  /on\s+(\d{2}-\d{2}-\d{4}\s+at\s+\d{2}:\d{2}|\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}|\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i
);

  if (dateMatch) {

    try {

      let dt = dateMatch[1];

      if (dt.includes(' at ')) {

        const [date, time] = dt.split(' at ');

        const [day, month, year] = date.split('-');

        dt = `${year}-${month}-${day}T${time}:00`;

      } else {

        dt = dt.replace(/\//g, '-');

      }

      result.timestamp = new Date(dt).toISOString();

    } catch {

      result.timestamp = new Date().toISOString();

    }

  }

  // --------------------------------------------------
  // Success
  // --------------------------------------------------

  if (
  result.amount !== undefined &&
  result.reference &&
  result.senderName &&
  result.senderName !== 'Unknown Customer'
) {

    result.parsedSuccessfully = true;

  }

  return result;

}