export interface ParsedEquityTransaction {
  amount?: number;
  senderName?: string;
  senderPhone?: string;
  account?: string;
  reference?: string;
  balance?: number;
  currency?: string;
  timestamp?: string;
  parsedSuccessfully: boolean;
  type: 'eazzypay' | 'mobile_transfer' | 'equitel' | 'generic';
}

export function parseEquityMessage(message: string): ParsedEquityTransaction {

  const result: ParsedEquityTransaction = {
    parsedSuccessfully: false,
    currency: "KES",
    type: "generic"
  };

  if (!message) return result;

  // --------------------------------------------------
  // AMOUNT
  // Supports:
  // KES 5,500.00
  // KES. 10.00
  // KES 2500
  // --------------------------------------------------
  const amountMatch = message.match(/KES\.?\s?([\d,]+(?:\.\d{2})?)/i);

  if (amountMatch) {
    result.amount = Number(amountMatch[1].replace(/,/g, ""));
  }

  // --------------------------------------------------
  // NEW EQUITY DEPOSIT FORMAT
  //
  // "deposited to Equity Account in favor of
  //  FRANK AYUOYI ODHIAMBO Ref. Number UH9D72T9KE"
  // --------------------------------------------------
  const depositMatch = message.match(
    /deposited\s+to\s+Equity\s+Account\s+in\s+favor\s+of\s+(.+?)\s+Ref\.?\s+Number\s+([A-Z0-9]+)/i
  );

  if (depositMatch) {
    result.senderName = depositMatch[1].trim();
    result.reference = depositMatch[2].toUpperCase();
    result.account = "Equity Account";
    result.type = "mobile_transfer";
  }

  // --------------------------------------------------
  // EXISTING EQUITY / EAZZYPAY FORMAT
  //
  // "... from NAME Ref: ABC123 ..."
  // --------------------------------------------------
  if (!result.senderName) {
    const senderMatch = message.match(/from\s+([A-Za-z\s]+?)\s+Ref/i);

    if (senderMatch) {
      result.senderName = senderMatch[1].trim();
    }
  }

  // --------------------------------------------------
  // REFERENCE
  // Supports:
  // Ref: ABC123
  // Ref ABC123
  // Ref. Number ABC123
  // --------------------------------------------------
  if (!result.reference) {
    const refMatch = message.match(
      /Ref\.?\s*(?:Number\s*)?[:\s]+([A-Z0-9]+)/i
    );

    if (refMatch) {
      result.reference = refMatch[1].toUpperCase();
    }
  }

  // --------------------------------------------------
  // ACCOUNT
  // Existing format:
  // Acc 600123
  // --------------------------------------------------
  if (!result.account) {
    const accMatch = message.match(/Acc\s+(\d+)/i);

    if (accMatch) {
      result.account = accMatch[1];
    }
  }

  // --------------------------------------------------
  // BALANCE
  // --------------------------------------------------
  const balMatch = message.match(
    /Balance\s+KES\.?\s?([\d,]+(?:\.\d{2})?)/i
  );

  if (balMatch) {
    result.balance = Number(balMatch[1].replace(/,/g, ""));
  }

  // --------------------------------------------------
  // TIMESTAMP
  //
  // Example:
  // on 09-08-2026 at 13:08
  // --------------------------------------------------
  const timestampMatch = message.match(
    /on\s+(\d{2}-\d{2}-\d{4})\s+at\s+(\d{2}:\d{2})/i
  );

  if (timestampMatch) {
    const [, date, time] = timestampMatch;

    const [day, month, year] = date.split("-");

    result.timestamp = new Date(
      `${year}-${month}-${day}T${time}:00`
    ).toISOString();
  }

  // --------------------------------------------------
  // FINAL PARSE CHECK
  // --------------------------------------------------
  if (result.amount !== undefined && result.reference) {
    result.parsedSuccessfully = true;
  }

  return result;
}