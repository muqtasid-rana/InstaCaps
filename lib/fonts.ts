import { Anton, Inter_Tight, Montserrat, Poppins } from "next/font/google";
import type { FontKey } from "./types";

export const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });
const interTight = Inter_Tight({ subsets: ["latin"] }); // variable font: every weight
const montserrat = Montserrat({ subsets: ["latin"] }); // variable font: every weight
const anton = Anton({ subsets: ["latin"], weight: "400" });

export const FONTS: Record<FontKey, { label: string; family: string; fixedWeight?: number }> = {
  interTight: { label: "Inter Tight (Helvetica look-alike)", family: interTight.style.fontFamily },
  helvetica: { label: "Helvetica (Mac) / Arial (Windows)", family: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  poppins: { label: "Poppins", family: poppins.style.fontFamily },
  montserrat: { label: "Montserrat", family: montserrat.style.fontFamily },
  anton: { label: "Anton (condensed)", family: anton.style.fontFamily, fixedWeight: 400 },
};
