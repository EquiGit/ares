export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  senderName: string;
  senderPhone?: string;
  reference: string;
  account: string;
  timestamp: string;
  balance?: number;
  rawMessage: string;
  status: 'completed' | 'failed' | 'pending';
  parsedSuccessfully: boolean;
  type: 'eazzypay' | 'mobile_transfer' | 'equitel' | 'mpesa' | 'generic';
}

export interface WebhookConfig {
  webhookUrl: string;
  secretToken: string;
}

export interface Stats {
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
  todayAmount: number;
  todayCount: number;
}
