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

  getAllExecutiveReports: async (): Promise<AllExecutiveReports> => {
    const res = await fetch(`${API_URL}/reports/all-executive`);
    if (!res.ok) throw new Error('Error al obtener reportes ejecutivos');
    return res.json();
  },

  getExecutiveReport: async (stage: 'buyer' | 'lead' | 'payer' | 'customer'): Promise<ExecutiveReportData> => {
    const res = await fetch(`${API_URL}/reports/executive/${stage}`);
    if (!res.ok) throw new Error(`Error al obtener reporte ejecutivo de ${stage}`);
    return res.json();
  },
};
