import Link from "next/link";
import BrandLogo from "./BrandLogo";

export default function Footer() {
  return (
    <footer suppressHydrationWarning={true} className="mt-20 w-full border-t border-white/5 bg-[#0a0a0a] pb-[calc(env(safe-area-inset-bottom)+76px)] md:pb-8 pt-12">
      <div suppressHydrationWarning={true} className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-6 px-4 md:flex-row md:px-8">
        <div suppressHydrationWarning={true} className="text-center md:text-left">
          <div suppressHydrationWarning={true} className="flex justify-center md:justify-start">
            <BrandLogo />
          </div>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            El mejor catálogo para explorar tus mangas favoritos. Actualizaciones diarias y la mejor calidad.
          </p>
        </div>

        <div suppressHydrationWarning={true} className="flex flex-wrap justify-center gap-6 text-sm font-medium text-gray-400">
          <Link href="/directorio" className="transition-colors hover:text-orange-500">
            Directorio
          </Link>
          <a href="https://t.me/+dtPKjcBfiDUyOWQx" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-orange-500">
            Comunidad
          </a>
          <Link href="/terminos" className="transition-colors hover:text-orange-500">
            Términos de Servicio
          </Link>
          <Link href="/privacidad" className="transition-colors hover:text-orange-500">
            Política de Privacidad
          </Link>
          <Link href="/dmca" className="transition-colors hover:text-orange-500">
            DMCA / Copyright
          </Link>
        </div>
      </div>
      <div suppressHydrationWarning={true} className="mx-auto mt-10 max-w-[1600px] px-4 text-center text-xs text-gray-600 md:px-8">
        &copy; {new Date().getFullYear()} MangaStoon. Todos los derechos reservados. Este sitio no
        almacena ningun archivo en su servidor. Todo el contenido es provisto por terceros no afiliados.
      </div>
    </footer>
  );
}
