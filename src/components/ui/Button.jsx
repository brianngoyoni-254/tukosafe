import { Link } from 'react-router-dom';

const styles = {
  base:
    'inline-flex items-center justify-center gap-2 min-h-12 px-5 py-3 rounded-xl border-2 border-transparent font-bold cursor-pointer no-underline transition-transform active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed',
  variants: {
    primary: 'bg-accent text-white hover:opacity-95',
    amber: 'bg-amber text-[#1b1200] hover:opacity-95',
    danger: 'bg-red text-white hover:opacity-95',
    ghost: 'bg-transparent border-white/30 text-white hover:bg-white/10',
    outline: 'bg-transparent border-line text-ink hover:bg-accentbg hover:text-ink',
  },
  sizes: { sm: 'min-h-10 px-3.5 py-2 text-sm', md: '', lg: 'min-h-14 text-lg' },
};

export default function Button({ variant = 'primary', size = 'md', to, href, className = '', children, ...rest }) {
  const cls = `${styles.base} ${styles.variants[variant]} ${styles.sizes[size]} ${className}`;
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>;
  return <button className={cls} {...rest}>{children}</button>;
}