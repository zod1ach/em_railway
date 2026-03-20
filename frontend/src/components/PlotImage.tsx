export function PlotImage({ src, alt }: { src?: string; alt: string }) {
  if (!src) return null;
  return (
    <div className="border border-border overflow-hidden bg-background">
      <img src={`data:image/png;base64,${src}`} alt={alt} className="w-full h-auto" />
    </div>
  );
}
