import React from 'react';
import { BuyerModuleLayout } from '../components/layout/BuyerModuleLayout';
import { BuyerOverviewView } from '../components/views/BuyerOverviewView';

export default function BuyerPage() {
  return (
    <BuyerModuleLayout
      title="Resumen Ejecutivo & Panel de Captación"
      subtitle="Monitoreo en tiempo real de contactos entrantes, alertas activas y cumplimiento de SLAs de primera atención."
    >
      <BuyerOverviewView />
    </BuyerModuleLayout>
  );
}
