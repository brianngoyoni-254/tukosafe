import { LuTriangleAlert } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';

/** Shown on auth pages when the Supabase settings are missing or unsafe. Renders nothing when configured. */
export default function ConfigNotice() {
  const { configured, configProblem } = useAuth();
  if (configured) return null;
  return (
    <div className="mb-4 p-3 rounded-lg bg-amberbg text-ink text-sm border border-amber/40" role="alert">
      <p className="flex items-start gap-2 font-bold m-0">
        <LuTriangleAlert size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
        Accounts are not connected yet
      </p>
      <p className="m-0 mt-1.5">{configProblem}</p>
      <p className="m-0 mt-1.5 text-mut">
        Add your Supabase Project URL and public key to <code>.env.local</code> (template: <code>.env.example</code>), restart
        the dev server, then run <code>npm run check:supabase</code>.
      </p>
    </div>
  );
}
