import { Redirect } from 'wouter';
import { useAuth } from '@/store/AuthContext';
import { useLocation } from 'wouter';
import { ShieldOff } from 'lucide-react';

export default function DoctorPortalIndex() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user?.permissions?.includes('doctor_portal.access' as string as never)) {
    return <Redirect to="/doctor-portal/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a2540] to-[#1a3a5c] flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <ShieldOff size={32} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h1>
        <p className="text-gray-500 mb-6">
          Accès réservé au personnel médical.
          <br />
          Vous n'avez pas la permission d'accéder au portail médecin.
        </p>
        <button
          onClick={() => setLocation('/')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          ← Retour à l'ERP
        </button>
      </div>
    </div>
  );
}
