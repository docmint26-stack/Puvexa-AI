export type PartnerType = "investor" | "launchpad" | "ecosystem";

export type PartnerPlate = "light" | "neutral" | "dark";

export interface InvestorPartner {
  id: string;
  name: string;
  logo: string;
  logoSource: string;
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
    logoSource:
      "https://images.squarespace-cdn.com/content/v1/66f07b720a24ce656c827f3b/0d5d687a-c639-41bc-b945-193b844f1528/VANTEC+logo.png?format=1500w",
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
    logoSource: "https://www.inovia.vc/",
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
    logoSource: "https://www.backed.vc/",
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
    logoSource: "https://www.skyland.vc/brand/skyland-ventures-logo.png",
    website: "https://www.skyland.vc/",
    type: "investor",
    plate: "light",
    width: 720,
    height: 720,
  },
  {
    id: "htx-ventures",
    name: "HTX Ventures",
    logo: "/partners/htx-ventures.svg",
    logoSource: "https://www.htx.com/v4/hbg-fed-en/en-us/static/img/header_logo.66f4ed2.svg",
    website: "https://www.htx.com/en-us/capital/",
    type: "investor",
    plate: "dark",
    width: 230,
    height: 40,
  },
  {
    id: "ibc-group",
    name: "IBC Group (Mario Nawfal)",
    logo: "/partners/ibc-group.svg",
    logoSource:
      "https://cdn.prod.website-files.com/661d0f918d13ed16329b7f74/661d0f918d13ed16329b7fb4_IBC_Typemark01.svg",
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
    logoSource: "https://daomaker.com/",
    website: "https://daomaker.com/",
    type: "launchpad",
    plate: "dark",
    width: 160,
    height: 50,
  },
  {
    id: "trustfi",
    name: "TrustFi",
    logo: "/partners/trustfi.png",
    logoSource: "https://trustfi.org/img/logos/logo-with-text-horizontal-white.png",
    website: "https://trustfi.org/",
    type: "launchpad",
    plate: "dark",
    width: 1786,
    height: 646,
  },
  {
    id: "huostarter",
    name: "Huostarter",
    logo: "/partners/huostarter.svg",
    logoSource: "https://www.huostarter.io/_next/static/media/HoustarLogo12.0d352fc5.svg",
    website: "https://www.huostarter.io/",
    type: "launchpad",
    plate: "light",
    width: 160,
    height: 45,
  },
  {
    id: "kommunitas",
    name: "Kommunitas",
    logo: "/partners/kommunitas.svg",
    logoSource: "https://kommunitas.net/images/kom-logo.svg",
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
    logoSource: "https://www.bscs.finance/images/header/bscs.svg",
    website: "https://www.bscs.finance/",
    type: "launchpad",
    plate: "neutral",
    width: 130,
    height: 32,
  },
  {
    id: "ember-network",
    name: "Ember Network",
    logo: "/partners/ember-network.png",
    logoSource:
      "https://staking.embernetwork.io/static/media/logo-ember-invert-transparent.d2b2d3ca54ee5cc646cb.png",
    website: "https://embernetwork.io/",
    type: "ecosystem",
    plate: "neutral",
    width: 900,
    height: 132,
  },
  {
    id: "kingdomstarter",
    name: "KingdomStarter",
    logo: "/partners/kingdomstarter.svg",
    logoSource: "https://kingdomstarter.io/images/sidebar/full-logo.svg",
    website: "https://kingdomstarter.io/",
    type: "launchpad",
    plate: "dark",
    width: 161,
    height: 28,
  },
];
