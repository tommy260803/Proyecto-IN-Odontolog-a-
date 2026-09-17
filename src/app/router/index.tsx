import { createBrowserRouter, Navigate } from 'react-router-dom';
import BuyerPage from '@/modules/buyer/pages/BuyerPage';
import NewBuyerPage from '@/modules/buyer/pages/NewBuyerPage';
import BuyerDetailPage from '@/modules/buyer/pages/BuyerDetailPage';
import BuyerRequestInfoPage from '@/modules/buyer/pages/BuyerRequestInfoPage';
import LeadPage from '@/modules/lead/pages/LeadPage';
import LeadDetailPage from '@/modules/lead/pages/LeadDetailPage';
import LeadNegotiationPage from '@/modules/lead/pages/LeadNegotiationPage';
import PayerPage from '@/modules/payer/pages/PayerPage';
import PayerDetailPage from '@/modules/payer/pages/PayerDetailPage';
import CustomerPage from '@/modules/customer/pages/CustomerPage';
import CustomerDetailPage from '@/modules/customer/pages/CustomerDetailPage';
import TurnedPage from '@/modules/turned/pages/TurnedPage';
import TurnedDetailPage from '@/modules/turned/pages/TurnedDetailPage';
import AppLayout from '@/app/layouts/AppLayout';

export const router = createBrowserRouter([
  {
    path: '/solicitar-informacion',
    element: <BuyerRequestInfoPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        path: '/',
        element: <Navigate to="/buyer" replace />,
      },
      {
        path: 'buyer',
        element: <BuyerPage />,
      },
      {
        path: 'buyer/new',
        element: <NewBuyerPage />,
      },
      {
        path: 'buyer/:id',
        element: <BuyerDetailPage />,
      },
      {
        path: 'lead',
        element: <LeadPage />,
      },
      {
        path: 'lead/:id',
        element: <LeadDetailPage />,
      },
      {
        path: 'lead/:id/negotiation',
        element: <LeadNegotiationPage />,
      },
      {
        path: 'payer',
        element: <PayerPage />,
      },
      {
        path: 'payer/:id',
        element: <PayerDetailPage />,
      },
      {
        path: 'customer',
        element: <CustomerPage />,
      },
      {
        path: 'customer/:id',
        element: <CustomerDetailPage />,
      },
      {
        path: 'turned',
        element: <TurnedPage />,
      },
      {
        path: 'turned/:id',
        element: <TurnedDetailPage />,
      },
    ],
  },
]);
