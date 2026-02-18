
export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  notes: string;
  sourceFile: string; // New field to track which file this transaction belongs to
}

export interface ExtractionResponse {
  transactions: Transaction[];
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface FileData {
  name: string;
  base64: string;
  type: string;
}
