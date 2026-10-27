import React from 'react';
import { BuyerModuleLayout } from '../components/layout/BuyerModuleLayout';
import { BuyerAlertsView } from '../components/views/BuyerAlertsView';

export default function BuyerAlertsPage() {
  return (
    <BuyerModuleLayout
      title="Centro de Resolución de Impulse Alerts"
      subtitle="Detección y resolución auditada de anomalías ALT-BUY-01 a ALT-BUY-05 para salvaguardar el flujo comercial."
    >
      <BuyerAlertsView />
    </BuyerModuleLayout>
  );
}
