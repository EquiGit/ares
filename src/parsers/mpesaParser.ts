export interface ParsedMpesaTransaction {
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

export function parseMpesaMessage(message: string): ParsedMpesaTransaction {

  const result: ParsedMpesaTransaction = {
    parsedSuccessfully: false,
    currency: "KES",
    type: "generic"
  };

  if (!message) return result;

  // Amount sent
  const amountMatch = message.match(/Ksh\s?([\d,]+\.\d{2}|[\d,]+)/i);
  if (amountMatch) {
    result.amount = Number(amountMatch[1].replace(/,/g, ""));
  }

  // Recipient account
  const accountMatch = message.match(/Account\s+for\s+account\s+(\d+)/i);
  if (accountMatch) {
    result.account = accountMatch[1];
  }

  // Transaction reference
  const refMatch = message.match(/([A-Z0-9]{10})\s+Confirmed/i);
  if (refMatch) {
    result.reference = refMatch[1].toUpperCase();
  }

  // Balance
  const balanceMatch = message.match(/balance\s+is\s+Ksh([\d,]+\.\d{2}|[\d,]+)/i);
  if (balanceMatch) {
    result.balance = Number(balanceMatch[1].replace(/,/g, ""));
  }

  if (result.amount && result.reference) {
    result.parsedSuccessfully = true;
  }

  return result;
}