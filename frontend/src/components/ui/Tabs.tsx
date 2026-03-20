import { cn } from "@/lib/cn";
import { ReactNode, createContext, useContext, useState } from "react";

const Ctx = createContext<{ active: string; set: (v: string) => void }>({ active: "", set: () => {} });

export function Tabs({ defaultValue, children, className }: { defaultValue: string; children: ReactNode; className?: string }) {
  const [active, set] = useState(defaultValue);
  return <Ctx.Provider value={{ active, set }}><div className={cn("flex-1 flex flex-col", className)}>{children}</div></Ctx.Provider>;
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end gap-0 overflow-x-auto", className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { active, set } = useContext(Ctx);
  const isActive = active === value;
  return (
    <button
      onClick={() => set(value)}
      className={cn(
        "relative whitespace-nowrap px-6 h-[52px] flex items-center justify-center font-display text-[15px] tracking-[0.12em] transition-colors",
        isActive ? "text-accent" : "text-muted hover:text-text-secondary",
        className,
      )}
    >
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
      )}
    </button>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { active } = useContext(Ctx);
  if (active !== value) return null;
  return <div className={cn("", className)}>{children}</div>;
}
