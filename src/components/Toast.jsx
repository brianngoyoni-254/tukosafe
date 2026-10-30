import { useApp } from '../context/app-context';

export default function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 bottom-[calc(90px+env(safe-area-inset-bottom,0px))] md:bottom-[calc(20px+env(safe-area-inset-bottom,0px))] bg-deep text-white px-4 py-3 rounded-xl z-50 max-w-[90vw] text-sm shadow-lg"
    >
      {toast}
    </div>
  );
}