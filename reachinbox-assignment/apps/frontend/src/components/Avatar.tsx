export function Avatar({ name, src, size = 'md' }: { name: string; src?: string | null; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
  return src ? <img className={`avatar avatar-${size}`} src={src} alt="" /> : <div className={`avatar avatar-${size} avatar-fallback`}>{initials}</div>;
}
