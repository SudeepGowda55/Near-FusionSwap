export interface HTLCResponse {
  htlc_id: string;
  secret: string;
  hash: string;
  contract_address: string;
  message: string;
  status: string;
  transaction_hash?: string;
  explorer_url?: string;
  receipts?: string[];
} 