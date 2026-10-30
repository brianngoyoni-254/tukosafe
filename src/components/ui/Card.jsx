export default function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={`bg-white border border-line rounded-2xl p-5 shadow-[0_14px_34px_rgba(7,39,36,0.06)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}