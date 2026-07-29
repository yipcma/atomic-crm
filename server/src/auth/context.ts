import "hono";

export interface CurrentSale {
  id: number;
  administrator: boolean;
  disabled: boolean;
}

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    sale: CurrentSale;
  }
}
