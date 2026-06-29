import Link from 'next/link';
import Image from 'next/image';
import logoIcon from '../icon.png';

export default function BrandLogo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2 group cursor-pointer animate-fade-in">
      <Image
        src={logoIcon}
        alt="LectorFenix Logo"
        width={32}
        height={32}
        className="h-7 w-7 shrink-0 transition-transform duration-300 group-hover:scale-110 md:h-8 md:w-8 object-contain drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]"
        priority
      />

      <span className="hidden md:inline truncate text-sm font-black tracking-tight text-white sm:text-base md:text-lg">
        LECTOR<span className="text-orange-500">FENIX</span>
      </span>
    </Link>
  );
}

