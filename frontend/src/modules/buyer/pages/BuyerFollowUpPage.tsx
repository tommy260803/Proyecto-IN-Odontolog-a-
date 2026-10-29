import React from 'react';
import { BuyerModuleLayout } from '../components/layout/BuyerModuleLayout';
import { BuyerFollowUpView } from '../components/views/BuyerFollowUpView';

export default function BuyerFollowUpPage() {
  return (
    <BuyerModuleLayout
      title="Bandeja de Seguimiento & Cumplimiento SLA"
      subtitle="Priorización de contactos pendientes, control del estándar < 15 minutos y registro de primera respuesta."
    >
      <BuyerFollowUpView />
    </BuyerModuleLayout>
  );
}
