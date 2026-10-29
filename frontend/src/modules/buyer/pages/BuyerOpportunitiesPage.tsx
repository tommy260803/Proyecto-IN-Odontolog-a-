import React from 'react';
import { BuyerModuleLayout } from '../components/layout/BuyerModuleLayout';
import { BuyerOpportunitiesView } from '../components/views/BuyerOpportunitiesView';

export default function BuyerOpportunitiesPage() {
  return (
    <BuyerModuleLayout
      title="Gestión de Oportunidades de Captación"
      subtitle="Búsqueda avanzada, filtrado multicriterio, estados de calificación y expediente comercial de prospectos."
    >
      <BuyerOpportunitiesView />
    </BuyerModuleLayout>
  );
}
