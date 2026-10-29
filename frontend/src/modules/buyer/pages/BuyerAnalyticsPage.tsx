import React from 'react';
import { BuyerModuleLayout } from '../components/layout/BuyerModuleLayout';
import { BuyerAnalyticsView } from '../components/views/BuyerAnalyticsView';

export default function BuyerAnalyticsPage() {
  return (
    <BuyerModuleLayout
      title="Business Intelligence & KPIs Oficiales del Data Mart"
      subtitle="Evaluación de KPIs B1 (Conversión 14d), B2 (Contactos Utilizables) y B3 (CPL) contra los benchmarks del informe académico."
    >
      <BuyerAnalyticsView />
    </BuyerModuleLayout>
  );
}
