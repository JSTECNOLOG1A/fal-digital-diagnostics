/**
 * PageContainer — wrapper global de layout por tipo de tela.
 *
 * Variantes:
 *   full      — sem max-width (telas fullscreen/embed)
 *   wide      — até 1800px (analíticas: diagnóstico, plano, financeiro, dashboard)
 *   standard  — até 1440px (listagens gerais)
 *   document  — até 1400px (relatórios narrativos, documentos)
 *   form      — até 1100px (formulários de cadastro)
 */
export default function PageContainer({
  children,
  variant = "wide",
  className = "",
}) {
  const variants = {
    full:     "max-w-none",
    wide:     "max-w-[1800px]",
    standard: "max-w-[1440px]",
    document: "max-w-[1400px]",
    form:     "max-w-[1100px]",
  };

  return (
    <div className={`w-full ${variants[variant]} mx-auto px-6 lg:px-8 xl:px-10 ${className}`}>
      {children}
    </div>
  );
}