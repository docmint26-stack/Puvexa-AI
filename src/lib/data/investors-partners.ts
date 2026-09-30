export type PartnerType = "investor" | "launchpad" | "ecosystem";

export type PartnerPlate = "light" | "neutral" | "dark";

export interface InvestorPartner {
  id: string;
  name: string;
  logo: string;
  website: string;
  type: PartnerType;
  plate: PartnerPlate;
  width: number;
  height: number;
  logoClassName?: string;
}

export const investorsAndPartners: InvestorPartner[] = [
  {
    id: "vantec-angel-network",
    name: "Vantec Angel Network",
    logo: "/partners/vantec-angel-network.png",
    website: "https://www.vantec.ca/",
    type: "investor",
    plate: "light",
    width: 402,
    height: 112,
  },
  {
    id: "inovia-capital",
    name: "Inovia Capital",
    logo: "/partners/inovia-capital.svg",
    website: "https://www.inovia.vc/",
    type: "investor",
    plate: "neutral",
    width: 335,
    height: 77,
  },
  {
    id: "backed-vc",
    name: "Backed VC",
    logo: "/partners/backed-vc.svg",
    website: "https://www.backed.vc/",
    type: "investor",
    plate: "light",
    width: 189,
    height: 27,
  },
  {
    id: "skyland-ventures",
    name: "Skyland Ventures",
    logo: "/partners/skyland-ventures.png",
    website: "https://www.skyland.vc/",
    type: "investor",
    plate: "light",
    width: 400,
    height: 394,
  },
  {
    id: "htx-ventures",
    name: "HTX Ventures",
    logo: "/partners/htx-ventures.png",
    website: "https://www.htx.com/en-us/capital/",
    type: "investor",
    plate: "light",
    width: 319,
    height: 259,
    logoClassName: "max-h-14",
  },
  {
    id: "ibc-group",
    name: "IBC Group (Mario Nawfal)",
    logo: "/partners/ibc-group.svg",
    website: "https://ibcgroup.io/",
    type: "ecosystem",
    plate: "neutral",
    width: 400,
    height: 198,
  },
  {
    id: "dao-maker",
    name: "DAO Maker",
    logo: "/partners/dao-maker.svg",
    website: "https://daomaker.com/",
    type: "launchpad",
    plate: "neutral",
    width: 85,
    height: 67,
  },
  {
    id: "trustfi",
    name: "TrustFi",
    logo: "/partners/trustfi.png",
    website: "https://trustfi.org/",
    type: "launchpad",
    plate: "dark",
    width: 640,
    height: 231,
  },
  {
    id: "huostarter",
    name: "Huostarter",
    logo: "/partners/huostarter.svg",
    website: "https://www.huostarter.io/",
    type: "launchpad",
    plate: "light",
    width: 343,
    height: 413,
  },
  {
    id: "kommunitas",
    name: "Kommunitas",
    logo: "/partners/kommunitas.svg",
    website: "https://kommunitas.net/",
    type: "launchpad",
    plate: "neutral",
    width: 153,
    height: 177,
  },
  {
    id: "bscs",
    name: "BSCS",
    logo: "/partners/bscs.svg",
    website: "https://www.bscs.finance/",
    type: "launchpad",
    plate: "neutral",
    width: 143,
    height: 40,
  },
  {
    id: "ember-network",
    name: "Ember Network",
    logo: "/partners/ember-network.png",
    website: "https://embernet.io/",
    type: "ecosystem",
    plate: "neutral",
    width: 600,
    height: 88,
  },
  {
    id: "kingdomstarter",
    name: "KingdomStarter",
    logo: "/partners/kingdomstarter.svg",
    website: "https://kingdomstarter.io/",
    type: "launchpad",
    plate: "neutral",
    width: 340,
    height: 134,
  },
];
