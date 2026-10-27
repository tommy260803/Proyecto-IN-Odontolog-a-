import React from 'react';
import { BuyerModuleLayout } from '../components/layout/BuyerModuleLayout';
import { BuyerAgentView } from '../components/views/BuyerAgentView';

export default function BuyerAgentPage() {
  return (
    <BuyerModuleLayout
      title="Supervisión del Agente Inteligente de Marketing"
      subtitle="Auditoría de inferencias LLM Groq, ratio de cobertura frente a fallbacks deterministas y simulador de triaje en vivo."
    >
      <BuyerAgentView />
    </BuyerModuleLayout>
  );
}
