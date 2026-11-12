import { useSearchParams } from 'react-router-dom';
import { LeadReportsPanel } from '../components/LeadReportsPanel';

export default function ReportsPage() {
  const [searchParams] = useSearchParams();
  const period = searchParams.get('period');

  return (
    <div className="pb-8">
      <LeadReportsPanel key={period} initialPeriod={period} />
    </div>
  );
}
