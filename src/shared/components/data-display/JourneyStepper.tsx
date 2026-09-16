import { Phase } from '@/domain/enums';
import type { CustomerJourney } from '@/domain/entities';
import { Link } from 'react-router-dom';
import { Check, CircleDot, Circle } from 'lucide-react';

interface JourneyStepperProps {
  journey: CustomerJourney;
}

const PHASES = [
  { id: Phase.BUYER, label: 'BUYER', getLinkId: (j: CustomerJourney) => j.buyerId, route: '/buyer' },
  { id: Phase.LEAD, label: 'LEAD', getLinkId: (j: CustomerJourney) => j.leadId, route: '/lead' },
  { id: Phase.PAYER, label: 'PAYER', getLinkId: (j: CustomerJourney) => j.payerId, route: '/payer' },
  { id: Phase.CUSTOMER, label: 'CUSTOMER', getLinkId: (j: CustomerJourney) => j.customerId, route: '/customer' },
  { id: Phase.TURNED, label: 'TURNED', getLinkId: (j: CustomerJourney) => j.turnedId, route: '/turned' },
];

export function JourneyStepper({ journey }: JourneyStepperProps) {
  const currentIndex = PHASES.findIndex(p => p.id === journey.currentPhase);

  return (
    <div className="w-full bg-card border rounded-lg p-4 mb-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Trazabilidad del Recorrido (Customer Journey)</h3>
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-border z-0" />
        {PHASES.map((phase, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const recordId = phase.getLinkId(journey);
          
          let Icon = Circle;
          let colorClass;
          
          if (isCompleted || (recordId && !isCurrent)) {
            Icon = Check;
            colorClass = "text-primary bg-primary/10 border-primary";
          } else if (isCurrent) {
            Icon = CircleDot;
            colorClass = "text-primary bg-primary border-primary text-primary-foreground";
          } else {
            colorClass = "text-muted-foreground bg-card border-border";
          }

          const content = (
            <div className="flex flex-col items-center z-10 relative bg-card px-2">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mb-2 ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-xs font-semibold ${isCurrent ? 'text-primary' : isCompleted || recordId ? 'text-foreground' : 'text-muted-foreground'}`}>
                {phase.label}
              </span>
            </div>
          );

          if (recordId) {
            return (
              <Link key={phase.id} to={`${phase.route}/${recordId}`} className="group hover:opacity-80 transition-opacity">
                {content}
              </Link>
            );
          }

          return (
            <div key={phase.id} className="opacity-50">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
