const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface ExecutiveReportCategory {
  categoryName: string;
  items: Array<{
    itemName: string;
    values: Record<string, number>;
    total: number;
  }>;
  subtotals: Record<string, number>;
  subtotalTotal: number;
  subtotalLabel: string;
}

export interface ExecutiveReportData {
  stage: 'BUYER' | 'LEAD' | 'PAYER' | 'CUSTOMER';
  reportTitle: string;
  period: string;
  metric: string;
  rowHeader: string;
  superHeader: string;
  columns: string[];
  totalColumnName: string;
  categories: ExecutiveReportCategory[];
  grandTotals: Record<string, number>;
  grandTotal: number;
  grandTotalLabel: string;
  isCurrency: boolean;
  generatedAt: string;
  sourceMart: string;
}

export interface AllExecutiveReports {
  buyer: ExecutiveReportData;
  lead: ExecutiveReportData;
  payer: ExecutiveReportData;
  customer: ExecutiveReportData;
}

export interface MartStatus {
  status: string;
  source: string;
  driver: string;
  database: string;
  tables: Array<{ tabla: string; registros: number }>;
}

export const reportService = {
  getStatus: async (): Promise<MartStatus> => {
    const res = await fetch(`${API_URL}/reports/status`);
    if (!res.ok) throw new Error('Error al consultar estado de NexoSalud_Mart');
    return res.json();
  },

  getAllExecutiveReports: async (measures?: { buyer?: string; lead?: string; payer?: string; customer?: string }): Promise<AllExecutiveReports> => {
    let query = '';
    if (measures) {
      const params = new URLSearchParams();
      if (measures.buyer) params.append('buyerMeasure', measures.buyer);
      if (measures.lead) params.append('leadMeasure', measures.lead);
      if (measures.payer) params.append('payerMeasure', measures.payer);
      if (measures.customer) params.append('customerMeasure', measures.customer);
      const str = params.toString();
      if (str) query = `?${str}`;
    }
    const res = await fetch(`${API_URL}/reports/all-executive${query}`);
    if (!res.ok) throw new Error('Error al obtener reportes ejecutivos');
    return res.json();
  },

  getExecutiveReport: async (stage: 'buyer' | 'lead' | 'payer' | 'customer', measure?: string): Promise<ExecutiveReportData> => {
    const query = measure ? `?measure=${measure}` : '';
    const res = await fetch(`${API_URL}/reports/executive/${stage}${query}`);
    if (!res.ok) throw new Error(`Error al obtener reporte ejecutivo de ${stage}`);
    return res.json();
  },
};
