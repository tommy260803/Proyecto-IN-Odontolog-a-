import React from 'react';
import { BuyerModuleLayout } from '../components/layout/BuyerModuleLayout';
import { BuyerCampaignsView } from '../components/views/BuyerCampaignsView';

export default function BuyerCampaignsPage() {
  return (
    <BuyerModuleLayout
      title="Campañas Comerciales & Control de Inversión"
      subtitle="Atribución de captación publicitaria, registro de comprobantes en GastosCampana y cálculo del CPL preliminar."
    >
      <BuyerCampaignsView />
    </BuyerModuleLayout>
  );
}
