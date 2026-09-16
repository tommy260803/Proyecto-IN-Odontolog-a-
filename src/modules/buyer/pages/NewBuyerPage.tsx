import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/data-display/PageHeader';
import { BuyerForm } from '../components/BuyerForm';
import { useCreateBuyer } from '../hooks/useBuyerQueries';
import { useToast } from '@/shared/hooks/use-toast';
import type { BuyerFormValues } from '../schemas/buyerSchema';

export default function NewBuyerPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createBuyer = useCreateBuyer();

  const handleSubmit = (data: BuyerFormValues) => {
    createBuyer.mutate(data, {
      onSuccess: () => {
        toast({ title: '¡Éxito!', description: 'Buyer registrado correctamente.' });
        navigate('/buyer');
      },
      onError: (err) => {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <PageHeader 
        title="Registrar BUYER" 
        description="Ingresa los datos del nuevo interesado."
      />
      <BuyerForm onSubmit={handleSubmit} isLoading={createBuyer.isPending} />
    </div>
  );
}
