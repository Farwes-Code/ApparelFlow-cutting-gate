export type Light = "GREEN" | "YELLOW" | "RED";

export type Item = {
  id: number;
  componentId: number;
  expectedQty: number;
  actualQty: number | null;
  status: Light | null;
  component: { componentName: string; piecesPerGarment: number };
};

export type Log = {
  id: number;
  decision: "APPROVED" | "REJECTED";
  rejectionNote: string | null;
  wastagePct: number;
  timestamp: string;
  verifier: { fullName: string };
};

export type Order = {
  id: number;
  orderNo: string;
  status: "CUTTING_IN_PROGRESS" | "PENDING_VERIFICATION" | "REJECTED" | "VERIFIED" | "SEWING_STARTED";
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  createdAt: string;
  updatedAt: string;
  recipe: { id: number; recipeCode: string; name: string; category: string; stdFabricYards: number; wastageCap: number };
  creator: { fullName: string };
  items: Item[];
  logs: Log[];
  expectedFabricYds: number;
  wastagePct: number;
  overCap: boolean;
};

export type Recipe = {
  id: number;
  recipeCode: string;
  name: string;
  category: string;
  stdFabricYards: number;
  wastageCap: number;
  components: { id: number; componentName: string; piecesPerGarment: number }[];
};
