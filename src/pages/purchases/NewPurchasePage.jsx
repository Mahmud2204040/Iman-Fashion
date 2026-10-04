import { useNavigate, useSearchParams } from 'react-router-dom';
import PurchaseWorkbenchPage from './PurchaseWorkbenchPage.jsx';
import PurchaseDialog from './PurchaseDialog.jsx';

// Direct links open the same dialog over Purchase History; normal create actions stay on their page.
export default function NewPurchasePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return <>
    <PurchaseWorkbenchPage />
    <PurchaseDialog
      initialSupplierId={params.get('supplier') || ''}
      onClose={() => navigate('/purchases', { replace: true })}
      onCreated={(purchase) => navigate(`/purchases/${purchase.id}`, { replace: true })}
    />
  </>;
}
