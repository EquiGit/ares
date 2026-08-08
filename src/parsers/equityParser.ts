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

  // Amount
  const amountMatch = message.match(/KES\s?([\d,]+\.\d{2}|[\d,]+)/i);
  if (amountMatch) {
    result.amount = Number(amountMatch[1].replace(/,/g, ""));
  }

  // Sender
  const senderMatch = message.match(/from\s+([A-Za-z\s]+?)\s+Ref/i);
  if (senderMatch) {
    result.senderName = senderMatch[1].trim();
  }

  // Reference
  const refMatch = message.match(/Ref[:\s]+([A-Z0-9]+)/i);
  if (refMatch) {
    result.reference = refMatch[1].toUpperCase();
  }

  // Account
  const accMatch = message.match(/Acc\s+(\d+)/i);
  if (accMatch) {
    result.account = accMatch[1];
  }

  // Balance
  const balMatch = message.match(/Balance\s+KES\s?([\d,]+\.\d{2}|[\d,]+)/i);
  if (balMatch) {
    result.balance = Number(balMatch[1].replace(/,/g, ""));
  }

  if (result.amount && result.reference) {
    result.parsedSuccessfully = true;
  }

  return result;
}