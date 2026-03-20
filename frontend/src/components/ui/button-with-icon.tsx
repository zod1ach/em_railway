import { ArrowUpRight } from "lucide-react";

interface LaunchButtonProps {
  label?: string;
  onClick?: () => void;
}

const LaunchButton = ({ label = "Let's Collaborate", onClick }: LaunchButtonProps) => {
  return (
    <button
      onClick={onClick}
      className="relative text-sm font-medium rounded-full h-12 p-1 ps-6 pe-14 group transition-all duration-500 hover:ps-14 hover:pe-6 w-fit overflow-hidden cursor-pointer bg-white text-black inline-flex items-center"
    >
      <span className="relative z-10 transition-all duration-500 tracking-wide">
        {label}
      </span>
      <div className="absolute right-1 w-10 h-10 bg-black text-white rounded-full flex items-center justify-center transition-all duration-500 group-hover:right-[calc(100%-44px)] group-hover:rotate-45">
        <ArrowUpRight size={16} />
      </div>
    </button>
  );
};

export default LaunchButton;
