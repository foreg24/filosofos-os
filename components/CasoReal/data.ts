/**
 * El caso de la vida real: THAI·NOW, una app de domicilios en hora pico.
 * Cada pedido es un filósofo (proceso) y cada ingrediente del inventario un tenedor (recurso):
 * el pedido i necesita el ingrediente i y el i + 1, igual que Pi necesita Fi y F(i+1).
 */

export interface Customer {
  id: number;
  name: string;
  dish: string;
  /** Nombre corto para el grafo del servidor. */
  short: string;
  price: number;
  image: string;
  description: string;
}

export interface Ingredient {
  id: number;
  name: string;
  short: string;
}

export const INGREDIENTS: Ingredient[] = [
  { id: 0, name: "Fideos de arroz", short: "Fideos" },
  { id: 1, name: "Camarones", short: "Camarones" },
  { id: 2, name: "Limonaria", short: "Limonaria" },
  { id: 3, name: "Leche de coco", short: "Coco" },
  { id: 4, name: "Maní tostado", short: "Maní" },
];

export const CUSTOMERS: Customer[] = [
  {
    id: 0,
    name: "Ana",
    dish: "Pad Thai",
    short: "Pad Thai",
    price: 22000,
    image: "/images/caso/pad-thai.webp",
    description: "Fideos de arroz salteados con camarones, huevo, maní, brotes de soya y salsa de tamarindo.",
  },
  {
    id: 1,
    name: "Beto",
    dish: "Tom Yum",
    short: "Tom Yum",
    price: 20000,
    image: "/images/caso/tom-yum.webp",
    description: "Sopa picante de camarones, hierba limonaria, hongos y limón.",
  },
  {
    id: 2,
    name: "Caro",
    dish: "Green Curry",
    short: "Green Curry",
    price: 24000,
    image: "/images/caso/green-curry.webp",
    description: "Curry verde con pollo, verduras, limonaria y leche de coco.",
  },
  {
    id: 3,
    name: "Dani",
    dish: "Massaman Curry",
    short: "Massaman",
    price: 26000,
    image: "/images/caso/massaman.webp",
    description: "Curry suave de res con papa, leche de coco y maní tostado.",
  },
  {
    id: 4,
    name: "Eli",
    dish: "Satay Noodles",
    short: "Satay",
    price: 21000,
    image: "/images/caso/satay-noodles.webp",
    description: "Fideos de arroz con pollo y salsa satay de maní.",
  },
];

/** Los dos ingredientes de cada plato: el i y el i + 1 (el anillo de los filósofos). */
export const recipeOf = (id: number): [Ingredient, Ingredient] => [INGREDIENTS[id], INGREDIENTS[(id + 1) % INGREDIENTS.length]];

export const DELIVERY = 5000;
export const ORDER_NUMBER = "TN4827";

export const money = (n: number) => `$ ${n.toLocaleString("es-CO")}`;

/** Créditos de las fotos (Wikimedia Commons). */
export const PHOTO_CREDITS =
  "Fotos: Wikimedia Commons — Iudexvivorum, Andy Li y Daderot (CC0); Guilhem Vellut (CC BY 2.0); Vee Satayamas (CC BY 4.0).";
