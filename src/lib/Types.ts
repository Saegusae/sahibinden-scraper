export interface Listing {
  id: number;
  image?: string;
  brand: string;
  model: string;
  title?: string;
  year: number;
  km: number;
  color: string;
  price: string | null;
  date?: Date | string | null;
  area?: string | null;
}
